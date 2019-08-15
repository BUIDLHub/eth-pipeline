import BlockDataSource from './BlockDataSource';
import * as yup from 'yup';
import {Logger} from 'buidl-utils';

const schema = yup.object({
    web3: yup.object().required("SubscriptionDataSource missing web3")
});

const log = new Logger({component: "SubscriptionDataSource"});

export default class SubscriptionDataSource extends BlockDataSource {
    constructor(props) {
        super(props);
        schema.validateSync(props);
        this.web3 = props.web3;
        [
            'start',
            'stop'
        ].forEach(fn=>this[fn]=this[fn].bind(this));
    }

    async start(cb) {
        this.subCallback = async (block) => {
            if(block) {
                log.debug("incoming block", block.number);
                await cb(null, block);
            }
        };

        log.info("Starting subscription for new blocks");
        this.sub = this.web3.eth.subscribe('newBlockHeaders');
        this.sub.on("data", this.subCallback);
    }

    async stop(cb) {
        log.info("Stopping subscription data source");
        if(this.sub) {
            log.debug("SUB", this.sub);
            await this.sub.unsubscribe(r=>log.info("Subscriptions released: ", r));
            log.info("Unsubscribe request sent");
            this.sub = null;
            
        }

    }
}