var fs = require('fs'),
    path = require('path'),
    util = require('util')
    ;

/**
 * 创建多级目录
 * @param  {String} dirpath 路径
 * @param  {String} mode    模式
 */
var mkdirsSync = function(dirpath, mode) {
    dirpath = path.resolve(dirpath);
    // console.log(dirpath);
    if(fs.existsSync(dirpath)){
        return;
    }
    var dirs = dirpath.split(path.sep);
    // console.log(dirs);
    var dir = '';
    for(var i = 0; i < dirs.length; i++) {
        dir += path.join(dirs[i],path.sep);
        // console.log(dir);
        if(!fs.existsSync(dir)){
            fs.mkdirSync(dir, mode);
        }
    }
};

/**
 * 递归删除目录
 * @param  {String} dirpath 路径
 */
var rmdirsSync = function(dirpath){
    dirpath = path.resolve(dirpath);
    // console.log(dirpath);
    if(!fs.existsSync(dirpath)){
        return;
    }
    var dirs = fs.readdirSync(dirpath);
    // console.log(dirs);
    var dir, len = dirs.length;
    if(len === 0){
        return;
    }
    for(var i = 0; i < len; i++) {
        dir = path.join(dirpath, dirs[i]);
        // console.log(dir);
        if(fs.statSync(dir).isDirectory()){
            rmdirsSync(dir);
            fs.rmdirSync(dir);
        }else{
            fs.unlinkSync(dir);
        }
    }
}

/**
 * 列出指定目录的所有文件
 * @param  {String} dirpath      路径
 * @param  {String} type 需要读取的文件的格式, 多类型用","分割, 如: "css,js,html"
 * @param  {Boolean} recursive 是否递归
 * @return {Array}  返回文件名数组
 */
var listFilesSync = function(dirpath, type, recursive){
    var result = [];
    var subdir = arguments[3] || '';
    if(type){
        type = type.toLowerCase().replace(/\s+/g, '');
    }
    var typeList = type ? type.split(',') : false;
    dirpath = path.resolve(dirpath);
    var list = fs.readdirSync(dirpath);
    var ext, filepath, stat, reldir;
    //把文件按文件名排序
    list.sort();
    for(var i = 0, name; name = list[i]; i++) {
        filepath = path.join(dirpath , name);
        reldir = path.join(subdir, name);
        stat = fs.statSync(filepath);
        if(stat.isFile()){
            ext = path.extname(name).substr(1);
            if(typeList && typeList.indexOf(ext) === -1){
                continue;
            }
            result.push(reldir);
        }else if(stat.isDirectory() && recursive){
            result = result.concat(listFilesSync(filepath, type, recursive, reldir));
        }
    };
    return result;
}

/**
 * 拷贝文件到指定目录或指定名字
 * @param  {String} src       
 * @param  {String} dst       
 * @param  {Boolean} overwrite 
 */
var copyFileSync = function (src, dst, overwrite) {
    var stat, input, output;
    // console.log('coping ' + src);
    if(!fs.existsSync(src)){
        throw 'File ' + src + ' is not exists.';
    }
    //创建目标目录
    mkdirsSync(path.dirname(dst));

    //如果文件不存在, statSync 会出错
    var dstExists = fs.existsSync(dst);
    if(dstExists){
        stat = fs.statSync(dst);
        if(stat.isDirectory()){
            dst = path.join(dst, path.basename(src));
            if(fs.existsSync(dst)){//新文件不存在时, 就不用重新判断了
                stat = fs.statSync(dst);
            }
        }
        if(stat.isFile() && !overwrite){
            //是个文件且不能覆盖
            throw 'File ' + dst + ' is exists.';
        }
    }else{
        if(dst.lastIndexOf(path.sep) === dst.length - 1){
            // dst 是个目录
            dst = path.join(dst, path.basename(src));
        }
    }

    input = fs.createReadStream(src);
    output = fs.createWriteStream(dst);
    input.pipe(output);
};

/**
 * 写文件, 自动创建不存在的目录
 * @param  {String} filenName 
 * @param  {String} content   
 * @param  {String} charset   
 */
var writeFileSync = function(filenName, content, charset){
    mkdirsSync(path.dirname(filenName));
    fs.writeFileSync(filenName, content);
}


exports.mkdirsSync = mkdirsSync;
exports.rmdirsSync = rmdirsSync;

exports.listFilesSync = listFilesSync;
exports.copyFileSync = copyFileSync;
exports.writeFileSync = writeFileSync;