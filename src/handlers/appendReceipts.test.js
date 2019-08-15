import Handler from './appendReceipts';
import BlockSource from '../BlockDataSource';
import Pipeline from '../Pipeline';

describe("AppendReceipts", ()=>{
    it("should append block transactions if not present", done=>{
        let web3 = {
            eth: {
                getTransactionReceipt: async hash => {
                    return {
                        receiptData: "simulated"
                    }
                }
            }
        }

        let pl = new Pipeline({
            web3,
            blockSource: new TestBlockSource()
        });

        let h = new Handler();
        pl.use(h);

        let block = {
            number: 1,
            timestamp: Date.now(),
            transactions: [
                {
                    hash: "0x12345678987654321abcdefedcba123456789987654321"
                }
            ]
        }
        pl.push(block).then(()=>{
            if(!block.transactions[0].receipt) {
                return done(new Error("Expected transaction to have receipt attached"));
            }
            done();
        }).catch(done);
    });
        
        
});

class TestBlockSource extends BlockSource {
    constructor(props) {
        super(props);
        [
            'start',
            'stop'
        ].forEach(fn=>this[fn]=this[fn].bind(this));
    }

    async start() {

    }

    async stop() {

    }
}