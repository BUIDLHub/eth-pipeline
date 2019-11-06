import BlockDataSource from './BlockDataSource';
import * as yup from 'yup';
import { Mutex } from 'async-mutex';
import {Logger, RetryContext} from 'buidl-utils';

const schema = yup.object({
    web3: yup.object().required("PollingDataSource is missing web3"),
    interval: yup.number(), //defaults to 10 seconds
    lastKnownBlock: yup.number(), //defaults to current block-1
    lagBlocks: yup.number() //optionally stay behind head of chain
});

const lock = new Mutex();

const log = new Logger({component: "PollingDataSource"});

export default class PollingDataSource extends BlockDataSource {
    constructor(props) {
        super(props);
        schema.validateSync(props);
        this.web3 = props.web3;
        this.interval = props.interval || 10000;
        this.lastBlock = props.lastKnownBlock;
        this.polling = false;
        this.lagBlocks = props.lagBlocks || 0;
        this.stopCallback = null;
        [
            'start',
            'stop',
            "_isPolling"
        ].forEach(fn=>this[fn]=this[fn].bind(this));
    }

    async start(cb) {
        return new Promise(async (done,err)=>{
            let rel = await lock.acquire();
            
            try {
                if(this.polling) {
                    return done();
                }
                this.polling = true;
            } finally {
                rel();
            }

            try {
                let going = await this._isPolling();
                
                let s = Date.now();
                let fatalError = null;
    
                //main poll function
                let poller = async () => {
                    log.debug("Polling handler invoked");
                    //first, make sure we're supposed to keep going
                    let going = await this._isPolling();
                    if(!going) {
                        log.info("Polling stopped");
                        return;
                    }
    
                    //create a context for the fn retries
                    let ctx = new RetryContext({
                        name: "Block Poller",
                        maxRetries: 10,
                        continuationFilter: async e=>{
                            if(fatalError) {
                                return false; //don't keep going if we hit retry limit once
                            }
                            return await this._isPolling()
                        }
                    });
    
                    try {
                        //get the latest block to see if we need to poll at all
                        let currentBlock = 0;
                        await ctx.invoke(this.web3.eth.getBlockNumber, (e, n)=>{
                            if(e) {
                                this.fatalError = e;
                            } else {
                                currentBlock = n-1;
                            }
                        });
    
                        if(!currentBlock) {
                            log.error("Could not determine current block in polling loop, waiting for next run");
                            return;
                        }
                        currentBlock -= this.lagBlocks;
                        
                        if(this.lastBlock !== currentBlock) {
                            while(this.lastBlock !== currentBlock) {
                                going = await this._isPolling();
                                if(!going) {
                                    log.info("Polling stopped");
                                    break;
                                }

                                //try to poll for new block
                                await ctx.invoke(this.web3.eth.getBlock, async (e, b)=>{
                                    if(e) {
                                        fatalError = e;
                                    } else if(b) {
                                        if(this.lastBlock != b.number) {
                                            log.debug("Sending block",b.number,"to callback");
                                            try {
                                                await cb(null, b);
                                            } catch (e2) {
                                                log.error("Problem calling back with new block", e2);
                                            }
                                        }
                                        this.lastBlock = b.number;
                                    } else {
                                        log.debug("Getting no block back from web3 for block:", this.lastBlock+1);
                                    }
                                }, this.lastBlock+1, true);
                            }
                        } else {
                            log.debug("No new blocks to retrieve, waiting for next poll cycle", this.lastBlock, " === ", currentBlock);
                        }
    
                        going = await this._isPolling();
                        if(going) {
                            let next = this.interval - (Date.now()-s);
                            if(next < 0) {
                                next = this.interval;
                            }
                            log.debug("Next poll in", next,'ms...');
                            this.timeout = setTimeout(poller, next);
                        } else {
                            log.debug("No longer polling, not scheduling next poll cycle");
                            return;
                        }
                        
                    } catch (e) {
                        log.error("Problem invoking in retry context", e);
                        return cb(e);
                    }
                };
    
                going = await this._isPolling();
                let next = this.interval - (Date.now()-s);
                if(next < 0) {
                    next = this.interval;
                }
                if(going) {
                    this.timeout = setTimeout(poller, next);
                    log.info("Scheduling poll after", next,'ms');
                }
                done();
            } catch (e) {
                err(e);
            }
        });
    }

    stop() {
        return new Promise(async done=>{
            this.stopCallback = done;
            let rel = await lock.acquire();
            try {
                this.polling = false;
            } finally {
                rel();
            }
            if(this.timeout) {
                log.debug("Clearing scheduled poll");
                clearTimeout(this.timeout);
                this.timeout = null;
                done();
            }
        });
    }

    //safe access to polling flag
    async _isPolling() {
        let rel = await lock.acquire();
        try {
            return this.polling;
        } finally {
            rel();
        }
    }
}