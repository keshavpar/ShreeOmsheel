const mongoose =require('mongoose')
const schema =mongoose.Schema
mongoose.set('strictQuery', false);

const sale = new schema({
    sales: {
        type:Number,
        default:0
    },
    cgst: {
        type:Number,
        default:0
    },
    sgst: {
        type:Number,
        default:0
    },
    price: {
        type:Number,
        default:0
    }
})

module.exports=mongoose.model("Sale",sale);