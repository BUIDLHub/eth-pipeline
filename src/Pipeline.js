import * as yup from 'yup';
import {Logger} from 'buidl-utils';
import Handler from './Handler';

const schema = yup.object({
    blockSource: yup.object().required("Pipeline is missing blockSource"),
    web3: yup.object().required("Pipeline missing web3"),
    historyWindowSize: yup.number(), //default is 50 blocks
    blocks: yup.array() //not required
});

const log = new Logger({component: "ETHPipeline"});

/**
 * Pipeline uses a block data source to receive new blocks and runs them through a sequence 
 * of handlers. The order of handlers is determined by the order they are "used" (i.e. the 
 * order in which the use function is called to add them to the pipeline). 
 * 
 * A historyWindowSize propery can be provided to tell the pipeline how many blocks to
 * keep in memory at a time before asking handlers to remove any persisted state from previously 
 * received blocks. The pipeline can be also be initialized with a previous set of blocks in 
 * order to pick up processing from a last known state.
 */
export default class Pipeline {
    constructor(props) {
        schema.validateSync(props);
        this.blockSource = props.blockSource;
        this.web3 = props.web3;
        this.historyWindowSize = props.historyWindowSize || 50;
        this._blocks = props.blocks || [];
        this._handlers = [];
        [
            'start',
            'stop',
            'use',
            'push',
            '_processBlock',
            '_purgeBlock',
            "_prepareHandlers"
        ].forEach(fn=>this[fn] = this[fn].bind(this));
    }

    /**
     * Manually send a block through the pipeline of handlers for processing. This might be 
     * useful if you want to initialize the state of an app from historical block data.
     * 
     * @param {block to send through handlers} block 
     */
    async push(block) {
        if(this._handlers.length === 0) {
            throw new Error("No handler installed in pipeline. Nothing to process without handlers");
        }
        log.debug("Current block history size", this._blocks.length);
        if(this._blocks.length >= this.historyWindowSize) {
            log.debug("Purging block to maintain block history window...");
            await this._purgeBlock();
        }
        this._blocks.push(block);
        await this._processBlock(block);
    }

    /**
     * Start the pipeline's block source and run new blocks through installed handlers
     */
    async start() {
        if(this._handlers.length === 0) {
            throw new Error("No handlers installed in pipeline. Nothing to start without handlers");
        }

        //first, initialize all handlers
        await this._prepareHandlers((ctx,handler,next)=>{
            return handler.init(ctx, next);
        });

        let sourceCallback = async (e, block) => {
            if(e) {
                log.error("Problem getting block in source", e);
            } else if(block) {
                log.debug("Getting block", block.number);
                if(this._blocks.length >= this.historyWindowSize) {
                    log.debug("Purging block to maintain block history window...");
                    await this._purgeBlock();
                }
                this._blocks.push(block);
                await this._processBlock(block);
            }
        }
        return this.blockSource.start(sourceCallback);
    }

    /**
     * Stop block source and no longer receive new blocks
     */
    async stop() {
        return this.blockSource.stop();
    }

    /**
     * Install a Handler implementation to use for processing blocks and purge requests
     * 
     * @param {a Handler implementation} handler 
     */
    use(handler) {
        if(!(handler instanceof Handler)) {
            throw new Error("Handler must extends Handler class");
        }
        this._handlers.push(handler);
        return this;
    }

    async _processBlock(block) {
        log.debug("\nStarting block processing-----",block.number,"-------");
        await this._prepareHandlers((ctx,handler,next,reject)=>{
            log.debug("Processing block using handler", handler.name);
            return handler.newBlock(ctx, block, next,reject)
        })
        log.debug("\nEnding block processing-----",block.number,"-------");
    }

    async _purgeBlock() {
        let removed = this._blocks.shift();
        await this._prepareHandlers((ctx,handler,next,reject)=>{
            log.debug("Purging blocks using handler", handler.name);
            return handler.purgeBlock(ctx, removed, next,reject)
        });
    }


    async _prepareHandlers(fn) {
        let ctx = {
            startTime: Date.now(),
            web3: this.web3
        }
        
        let idx = 0;
        let next = async () => {
            ++idx;
            if(idx < this._handlers.length) {
                let h = this._handlers[idx];
                log.debug("Calling handler", h.name)
                try {
                    await fn(ctx, h, next);
                } catch (e) {
                    log.error("Problem with block handler", h.name, e);
                }
            } else {
                log.debug("Completed", idx, "route handlers in", (Date.now()-ctx.startTime),'ms');
            }
        }

        let reject = async () => {
            log.debug("Handler", this._handlers[idx].name, "rejected block. Short-ciruiting pipeline");
        }

        try {
            let h = this._handlers[0];
            log.debug("Calling handler", h.name);
            await fn(ctx, h, next, reject);
        } catch (e) {
            log.error("Problem with block handlers", e);
        }
    }
}