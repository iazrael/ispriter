var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    EventEmitter = require('events').EventEmitter,

    Logger = require('./Logger'),
    zTool = require('./ztool'),

    CSSSheet = require('./css').CSSSheet;


function SpriteTask(env, cssUri) {

    EventEmitter.call(this);

    this.env = env; // ispriter 的环境相关信息, 也就是 iSpriter 的实例

    this.cssUri = cssUri;

    this.init();
}

util.inherits(SpriteTask, EventEmitter);


SpriteTask.prototype.init = function() {

    var context = this,
        config = this.env.config;

    this.cssSheet = CSSSheet.parse(config, this.cssUri);

    // , function() {
    //     context.emit('inited');
    // });

};

/**
 * 返回这个 task 是否是有效的, 既是否有精灵图需要合并, 如果没有这没必要进行后续的处理
 *
 * @return {Boolean}
 */
SpriteTask.prototype.isValid = function() {

    return this.cssSheet && !!this.cssSheet.cssRules.length;
};

SpriteTask.prototype.exec = function() {

    // TODO 未完成
};

// function filterCSSRules (cssRules, config, onDone) {

//     cssRules.forEach(function(cssRule){
        
//     });

//     if(str === 'background' || str === 'background-image'){ // 进一步处理背景
//             match = value.match(constant.REGEXP_IMAGE);

//             if(!match){
//                 continue; //这个 background 是没有图片的, 或者图片格式不对
//             }

//             uri = match[1];
//             ext = match[2];
//             Logger.debug('get image: ', uri, ext);

//             // 把 config 没有指定的后缀都排除掉
            

//         }
//     // body...
// }

//TODO 不应该在SpriteTask类中 by bzai
SpriteTask.createTasks = function(env, callback) {

    var taskArr = [],
        config = env.config;

    zTool.forEach(config.input.cssSource, function(cssUri, index, next) { // onEach

        var task = new SpriteTask(env, cssUri);

        task.on('inited', function() {

            // 没有需要合并的图片的 task 就没必要放到 taskArr
            // if(task.isValid()){

            taskArr.push(task);
            // }
        })
            .on('inited', next);
    }, function() { //onDone

        callback && callback(taskArr);
    });
};

module.exports = SpriteTask;