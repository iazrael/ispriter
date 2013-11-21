

exports.debuging = false;

exports.debug = function(msg){

    if(exports.debuging){
        
        console.log('>>>', +new Date, msg, '\n<<<===================');
    }
}

exports.info = function(msg){

    console.info.apply(console, arguments);
}