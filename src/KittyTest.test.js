import axios from 'axios';
import Pipeline from './Pipeline';
import Poller from './PollingDataSource';
import Web3 from 'web3';
import Handler from './Handler';
import AddTransactions from './handlers/appendTransactions';
import AddReceipts from './handlers/appendReceipts';
import ETHHistory from 'eth-history';
import FilterAddress from './handlers/filterAddress';
import ABIDecodeHandler from './handlers/ABIDecodeHandler';
import _ from 'lodash';

const dotenv = require("dotenv");
dotenv.config();

const KITTY_CORE = "0x06012c8cf97bead5deae237070f9587f8e7a266d";
const BASE_ABI_URL = "http://api.etherscan.io/api?module=contract&action=getabi&address=";

const getABI = async () => {
  let abiUrl = BASE_ABI_URL + KITTY_CORE;
  let r = await axios.get(abiUrl);
  let res = _.get(r, "data.result");
  if(!res) {
    return null;
  }

  let abi = res;

  if(typeof res === 'string') {
    try {
      abi = JSON.parse(res);
    } catch (e) {
      return null;
    }
  }
  
  if(!abi.length) {
    return null;
  }
  return abi;
}


describe("KittyPipeline", ()=>{
    let web3 = null;
    let currentBlock = 0;
    let poller = null;
    let pipeline = null;
    let history = null;
    let abi = null;
    beforeEach(async ()=>{
        abi = await getABI();
        web3 = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_URL));
        currentBlock = await web3.eth.getBlockNumber();
        history = new ETHHistory({
            web3,
            abi,
            targetAddress: KITTY_CORE
        });
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

    it("Should filter kitty core address and decode events", done=>{
        let addTxns = new AddTransactions();
        let addRecs = new AddReceipts();
        let filterAddr = new FilterAddress(KITTY_CORE);
        //create a new contract so that abi gets encoded 
        new web3.eth.Contract(abi, KITTY_CORE);
        let abiDecode = new ABIDecodeHandler(abi);
        let last = new EventCounter({name: "EventCounter"});
        pipeline.use(addTxns).use(filterAddr).use(addRecs).use(abiDecode).use(last);
        history.recoverBlocks({
            fromBlock: currentBlock-5,
            toBlock: currentBlock-1,
            maxRetries: 10,
            concurrency: 2
        }, async (e, b)=>{
            if(e) {
                console.log("Problem with retrieving history", e);
            } else if(b) {
                await pipeline.push(b);
            } else {
                console.log("No block and no error in history callback!");
            }
        }).then(()=>{
            if(last.newCount === 0) {
                return done(new Error("Expected to get at least 1 txn with events"));
            } 
            if(last.eventCount === 0) {
                return done(new Error("Expected to get at least 1 event"));
            }
            done();
        }).catch(done);
       
    }).timeout(30000);
});


class EventCounter extends Handler {
    constructor(props) {
        super(props);
        this.newCount = 0;
        this.eventCount = 0;
        
        [
            'newBlock'
        ].forEach(fn=>this[fn]=this[fn].bind(this));
    }


    async newBlock(ctx, block, next, reject) {
        ++this.newCount;
        if(block.transactions && block.transactions.length > 0) {
            block.transactions.forEach(t=>{
                if(t.logEvents) {
                    this.eventCount += _.keys(t.logEvents).reduce((i,k)=>{
                        let a = t.logEvents[k];
                        return i+a.length;
                    }, 0);
                }
            });
        }
        console.log("Finished newBlock for handler", this.name)

        return next();
    }

}