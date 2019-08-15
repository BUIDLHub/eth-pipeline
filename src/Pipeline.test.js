import Pipeline from './Pipeline';
import Poller from './PollingDataSource';
import Web3 from 'web3';
import Handler from './Handler';
import {sleep} from 'buidl-utils';
import AddTransactions from './handlers/appendTransactions';
import AddReceipts from './handlers/appendReceipts';

const dotenv = require("dotenv");
dotenv.config();

describe("Pipeline", ()=>{
    let web3 = null;
    let currentBlock = 0;
    let poller = null;
    let pipeline = null;
    beforeEach(async ()=>{
        web3 = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_URL));
        currentBlock = await web3.eth.getBlockNumber();
        poller = new Poller({
            web3,
            interval: 1000,
            lastKnownBlock: currentBlock-2
        });
        pipeline = new Pipeline({
            blockSource: poller,
            web3,
        });
    });

    it("Should run new blocks through handlers", done=>{
        let h1 = new TestHandler({name: "H1"});
        let h2 = new TestHandler({name: "H2"});
        pipeline.use(h1).use(h2);
        pipeline.start().then(async ()=>{
            while(h1.newCount === 0) {
                await sleep(1000);
            }
            await pipeline.stop();
            if(h2.newCount === 0) {
                return done(new Error("Did not pass to every handler in pipeline"));
            }
            done();
        })
    }).timeout(30000);


    it("Should pass a block through manually", done=>{
        let h1 = new TestHandler({name: "H1"});
        pipeline.use(h1);
        pipeline.push({
            number: 1
        }).then(()=>{
            if(h1.newCount !== 1) {
                return done(new Error("Expected handler to get manually pushed block"));
            }
            done();
        }).catch(done);
        
    });

    it("Should purge blocks after reaching max window size", done=>{
        let h1 = new TestHandler({name: "H1"});
        let maxBlocks = 5;
        let totalBlocks = maxBlocks*2;
        pipeline = new Pipeline({
            blockSource: poller,
            web3,
            historyWindowSize: maxBlocks
        });
        pipeline.use(h1);
        setTimeout(async () =>{
            for(let i=0;i<totalBlocks;++i) {
                await pipeline.push({
                    number: i
                })
            }

            if(h1.newCount !== totalBlocks) {
                return done(new Error("Expected to receive all blocks"));
            }
            if(h1.purgeCount === 0) {
                return done(new Error("Expected to purge blocks after hitting max"));
            }
            done();

        }, 10);
    });

    it("Should append txns and receipts", done=>{
        let txns = new AddTransactions();
        let receipts = new AddReceipts();
        let end = new TestHandler({name: "Last"});
        pipeline.use(txns).use(receipts).use(end);

        pipeline.start().then(async ()=>{
            while(end.newCount === 0) {
                await sleep(1000);
            }
            await pipeline.stop();
            if(end.receiptCount === 0) {
                return done(new Error("Did not get receipts in pipeline"));
            }
            done();
        })
    }).timeout(30000);
});


class TestHandler extends Handler {
    constructor(props) {
        super(props);
        this.newCount = 0;
        this.purgeCount= 0;
        this.receiptCount = 0;
        [
            'newBlock',
            'purgeBlock'
        ].forEach(fn=>this[fn]=this[fn].bind(this));
    }


    async newBlock(ctx, block, next, reject) {
        ++this.newCount;
        if(block.transactions && block.transactions.length > 0) {
            block.transactions.forEach(t=>{
                if(t.receipt) {
                    ++this.receiptCount;
                }
            })
        }
        console.log("Finished newBlock for handler", this.name)

        return next();
    }

    async purgeBlock(ctx, block, next, reject) {
        ++this.purgeCount;
        return next();
    }

}