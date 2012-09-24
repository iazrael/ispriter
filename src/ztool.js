var fs = require('fs'),
    path = require('path');


// 创建多级目录
exports.mkdirsSync = function(dirpath, mode) {
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

// 批量读取文件
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



