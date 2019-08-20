/**
 * Router handler that retrieves receipts for each transactions and appends them to the txn objects
 */
import {Logger, RetryContext} from 'buidl-utils'
import Handler from '../Handler'

const log = new Logger({component: 'AppendReceipts'});

export default class ReceiptHandler extends Handler {
    constructor() {
        super({name:"ReceiptHandler"});
        [
            'newBlock'
        ].forEach(fn=>this[fn]=this[fn].bind(this));
    }

    async newBlock(ctx, block, next) {
        let txns = block.transactions;
        if(!txns || txns.length === 0) {
            return next();
        }
        let all = [];
        log.debug("Appending receipts to", txns.length,"transactions");
        let s = Date.now();
        let retry = new RetryContext({
            name: "getTransactionReceipts",
            maxRetries: 10,
            retryNullResults: true
        });
        txns.forEach(t=>{
            if(t.hash && !t.receipt) {
                all.push(retry.invoke(ctx.web3.eth.getTransactionReceipt,async (e, r)=>{
                    if(e) {
                        log.error("Problem retrieving receipt", e);
                    } else if(r) {
                        t.receipt = r;
                    } else {
                        log.error("Did not get receipt in results");
                    }
                },t.hash));
            }
        });
        if(all.length > 0) {
            await Promise.all(all);
            log.debug("Retrieved", txns.length,"receipts in",(Date.now()-s),"ms");
        }
        return next();
    }
}