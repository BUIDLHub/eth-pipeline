import {Logger, RetryContext} from 'buidl-utils';
import Handler from '../Handler';

const log = new Logger({component: "AppendTransactions"});


export default class AppendTransactions extends Handler {
    constructor() {
        super({name:"AppendTransactions"});
        [
            'newBlock'
        ].forEach(fn=>this[fn]=this[fn].bind(this));
    }


    async newBlock(ctx, block, next) {
        if(!block.transactions || block.transactions.length === 0 || typeof block.transactions[0] === 'string') {
            log.debug("Requesting transactions for block", block.number);
            let s = Date.now();
            let retry = new RetryContext({
                name: "getTransactions",
                maxRetries: 10,
                retryNullResults: true
            });
            let calls = [];
            //retreive full block
            await retry.invoke(ctx.web3.eth.getBlock, async (e, b)=>{
                if(e) {
                    log.error("Problem getting block with transactions", e);
                } else {
                    block.transactions = [
                        ...b.transactions
                    ];
                }
            }, block.number, true);
            block.transactions = block.transactions.map(t=>({
                ...t,
                timestamp: block.timestamp
            }));
            log.debug("Retrieved", block.transactions.length,"txns in", (Date.now()-s),"ms");
        } else {
            log.debug("Block", block.number, "already has transactions");
            block.transactions = block.transactions.map(t=>({
                ...t,
                timestamp: block.timestamp
            }));
        }
        return next();
    }

}