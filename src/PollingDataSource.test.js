import Poller from './PollingDataSource';
import Web3 from 'web3';

const dotenv = require('dotenv');
dotenv.config();

describe("PollingDataSource", ()=>{
    let web3 = null;
    let currentBlock = 0;
    beforeEach(async ()=>{
        web3 = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_URL));
        currentBlock = await web3.eth.getBlockNumber();
    });

    it("Should poll for new blocks", done=>{
        let poller = new Poller({
            web3,
            interval: 1000,
            lastKnownBlock: currentBlock-2
        });
        
        poller.start(async (e, b)=>{
            await poller.stop();
            if(e) {
                return done(e);
            }
            if(b) {
                done();
            }
        }).catch(done);
    }).timeout(15000);
});