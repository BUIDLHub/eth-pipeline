import Sub from './SubscriptionDataSource';
import Web3 from 'web3';

const dotenv = require("dotenv");
dotenv.config();

describe("SubscriptionDataSource", ()=>{
    let web3 = null;
    let current = 0;
    beforeEach(async ()=>{
        web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.WS_WEB3));
        current = await web3.eth.getBlockNumber();
    });


    it("Should receive new block without timeout", done=>{
        let sub = new Sub({
            web3
        });

        sub.start(async (e, b)=>{
            await sub.stop();
            if(e) {
                return done(e);
            }
            console.log("Received block", b);
            done();
        })
    }).timeout(30000);
});