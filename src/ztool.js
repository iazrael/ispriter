var fs = require('fs'),
    path = require('path');


/**
 * 创建多级目录
 * @param  {String} dirpath 路径
 * @param  {String} mode    文件模式
 */
var mkdirsSync = exports.mkdirsSync = function(dirpath, mode) {
    if(fs.existsSync(dirpath)){
        return;
    }
    var dirs = dirpath.split('/');
    var dir = '';
    for(var i = 0; i < dirs.length; i++) {
        dir += dirs[i] + '/';
        if(!fs.existsSync(dir)){
            fs.mkdirSync(dir, mode);
        }
    }
};

/**
 * 批量读取文件
 * @param  {String} dir      路径
 * @param  {String} fileType 需要读取的文件的格式
 * @return {Array}  返回文件的内容数组 [{fileName: '', content: buffer}]
 */
exports.readFilesSync = function(dir, fileType){
    var list,
        result = [],
        fileName,
        ext,
        stat;
    if(dir.lastIndexOf('/') !== dir.length - 1){
        dir += '/';
    }
    list = fs.readdirSync(dir);
    if(fileType && fileType.indexOf('.') === -1){
        fileType = '.' + fileType.toLowerCase();
    }
    for(var i = 0, name; name = list[i]; i++) {
        ext = path.extname(name);
        if(fileType && ext.toLowerCase() !== fileType){
            continue;
        }
        fileName = dir + name;
        stat = fs.statSync(fileName);
        if(!stat.isFile()){
            continue;
        }
        result.push({
            fileName: name,
            content: fs.readFileSync(fileName)
        });
    };
    return result;
}

/**
 * 写文件, 自动创建不存在的目录
 * @param  {[type]} fileName [description]
 * @param  {[type]} data     [description]
 * @return {[type]}          [description]
 */
exports.writeFileSync = function(fileName, data){
    var dir = path.dirname(fileName);
    mkdirsSync(dir);
    fs.writeFileSync(fileName, data);
}


