/**
 * @author azrael
 * @date 2013-11-21
 * @description canvas 的入口文件,用于检测 node-canvas
 * 
 */
var Logger = require('../Logger');


var type = 'PNGJS';
// try{
        // TODO 尚未调试, 暂时不启用
//     // 优先使用 node-canvas
//     type = require('canvas').Canvas && 'NodeCanvas';
// }catch(e){

//     try{

//         // 再尝试使用 pngjs
//         type = require('pngjs').PNG && 'PNGJS';
//     }catch(e){
//     }
// }

if(!type){
    throw new Error('[canvas] can\'t load any image lib');
}else{
    module.exports = require('./Canvas' + type + 'Impl');
    Logger.info('[canvas] load ' + type);
}