const mongoose =require('mongoose')
const schema =mongoose.Schema
mongoose.set('strictQuery', false);

const bill = new schema({
    billnopiumated: {
        type: Number,
        default:0
    },
    billnotopiumated: {
        type:Number,
        default:0
    }
})

module.exports=mongoose.model("Bill",bill);