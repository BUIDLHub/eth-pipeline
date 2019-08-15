
/**
 * Mostly an interface (maybe this should all be in Typescript) that the Pipeline will 
 * use to process blocks.
 * 
 * It is important that any Handler function call the "next" function so that all 
 * handlers in the pipeline get called. Unless a handler intentionally does not 
 * want to forward processing to the next handler. In that case, add an optional "reject"
 * argument to any of the Handler functions to reject the block and it will not be forwarded.
 */
export default class Handler {

    constructor(props) {
        if(!props.name) {
            throw new Error("Missing handler name in properties");
        }
        this.name = props.name;
        [
            'init',
            'newBlock',
            'purgeBlock'
        ].forEach(fn=>this[fn]=this[fn].bind(this));
    }

    /**
     * Initialize the handler with the given context resources
     * 
     * @param {context containing shared resources for all handlers} ctx 
     * @param {function to invoke next handler} next
     */
    async init(ctx, next) {
        return next();
    }

    /**
     * Process a new block 
     * 
     * @param {context containing shared resources} ctx 
     * @param {new block to process} block 
     * @param {function to invoke next handler} next 
     * @param {function to reject current block and not call downstream handlers} reject 
     */
    async newBlock(ctx, block, next, reject) {
        return next();
    }

    /**
     * During pipeline processing, it is inevitable that state will be preserved somewhere.
     * In these cases, it's useful to be able to purge that state when the system decides
     * that some threshold of persistence has been met. This function allows all handlers 
     * to remove any persisted state about the given blocks.
     * 
     * @param {context contianing shared resources} ctx 
     * @param {block to purge} block 
     * @param {function to invoke next handler} next 
     * @param {function to reject removal of current block and not call downstream handlers} reject 
     */
    async purgeBlock(ctx, block, next, reject) {
        return next();
    }
}