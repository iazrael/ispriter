

exports.debuging = false;

var slice = Array.prototype.slice;

exports.info = function(){

    var args = slice.call(arguments);
    args.unshift('>>>');
    args.push('<<<');
    console.info.apply(console, args);
};

exports.debug = function(){

    if(exports.debuging){
        var args = slice.call(arguments);
        args.unshift('[debug]<<<');
        args.push('>>>');
        console.log.apply(console, args);
    }
};

exports.error = function(){
    
    var args = slice.call(arguments);
    args.unshift('>>>\n>', new Date(),'\n');
    args.push('\n<<<');
    console.error.apply(console, args);
};