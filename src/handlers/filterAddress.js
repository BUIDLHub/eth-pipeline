import Handler from '../Handler';
import {Logger} from 'buidl-utils';

const log = new Logger({component: "FilterAddress"});

export default class FilterAddress extends Handler {
    constructor(address) {
        super({name: "FilterAddress"});
        if(typeof address !== 'string') {
            throw new Error("Invalid target address. Must be a valid ETH address");
        } 
        this.target = address.toLowerCase();
        [
            'newBlock'
        ].forEach(fn=>this[fn]=this[fn].bind(this));
    }

    async newBlock(ctx, block, next, reject) {
        //filter out txns where to/from address meets our target
        let txns = block.transactions.filter(t=>{
            let to = t.to;
            if(to) {
                to = to.toLowerCase();
                if(to === this.target) {
                    log.debug("Found matching address in txn", to);
                    return true;
                }
            }
            let from = t.from;
            if(from) {
                from = from.toLowerCase();
                if(from === this.target) {
                    log.debug("Found matching address in txn", from);
                    return true;
                }
            }
            return false;
        });

        if(txns.length === 0) {
            log.debug("Rejecting block since no matching txns found");
            return reject();
        }
        log.debug("Replacing block transactions with new set. Was", block.transactions.length, ", will now be", txns.length);
        block.transactions = txns;
        return next();
    }
}