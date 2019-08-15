import Handler from './appendTransactions';
import Pipeline from '../Pipeline';
import BlockSource from '../BlockDataSource';

describe("AppendTransactions", ()=>{
    it("should append block transactions if not present", done=>{
    
        let hashes = [
            "0x12345678987654321abcdefedcba123456789987654321"
        ]
        let txns = [
            {
                hash: "0x12345678987654321abcdefedcba123456789987654321",
                otherField: "someValue"
            }
        ]
        let block = {
            number: 1,
            transactions: hashes
        }

        let web3 = {
            eth: {
                getBlock: async number => {
                    return {
                        ...block,
                        transactions: txns
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
        pl.push(block).then(()=>{
            if(typeof block.transactions[0] === 'string') {
                return done(new Error("Expected to get new transactions"));
            }
            done();
        })
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