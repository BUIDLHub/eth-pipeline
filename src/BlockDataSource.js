
/**
 * Mostly an interface respresenting a source of block data. It's expected to 
 * provide hooks for the pipeline to receive new block data. This can be achieved
 * through polling or web3 subscriptions. Instead of coupling the pipeline to a specific
 * sourcing approach, it is instead injected as a utility to the pipeline with concrete
 * implementations provided as part of this library. 
 * 
 * @see PollingDataSource
 * @see SubscriptionDataSource
 */
export default class BlockDataSource {

    constructor(props) {
        [
            'start',
            'stop'
        ].forEach(fn=>this[fn]=this[fn].bind(this));
    }

    /**
     * Start receiving new blocks and send to the given callback fn
     * 
     * @param {callback function with sig (error,block)} cb 
     */
    async start(cb) {
        throw new Error("Must provide a 'start' implementation");
    }

    /**
     * Stop receiving new blocks
     */
    async stop() {
        throw new Error("Must provide a 'stop' implementation")
    }
}