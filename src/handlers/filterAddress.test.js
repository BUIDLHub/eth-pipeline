import Handler from './filterAddress';
import Pipeline from '../Pipeline';
import BlockSource from '../BlockDataSource';

describe("FilterAddress", ()=>{
    it("should filter unwanted addresses", done=>{
        let target = "0x123456789";
        
        let txns = [
            {
                hash: "0x12345678987654321abcdefedcba123456789987654321",
                to: "0xabcde123456"
            },
            {
                hash: "0xabcdef12345678987654321abcdefedcba123456789987654321",
                to: target
            }
        ];

        let block = {
            number: 1,
            transactions: txns
        }

        let web3 = {
            eth: {
                getBlock: async number => {
                    return block
                }
            }
        }

        let pl = new Pipeline({
            web3,
            blockSource: new TestBlockSource()
        });
        
        let h = new Handler(target);
        pl.use(h);
        pl.push(block).then(()=>{
            if(block.transactions.length !== 1) {
                return done(new Error("Expected to filter non-matching transactions"));
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