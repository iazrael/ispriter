var fs = require('fs'),
    CSSOM = require('./CSSOM.js');

var readConfig = function(configFile){
    var content = readFile(configFile);
    var config = JSON.parse(content);
    return config;
}

var readFile = function(fileName){
    return fs.readFileSync(fileName).toString();
}

var readFiles = function(dir){
    var list = fs.readdirSync(dir),
        result = [],
        cssNameReg = /\.css$/i,
        stat;
    for(var i = 0, name; name = list[i]; i++) {
        cssNameReg.test(name) && (stat = fs.statSync(dir + name)) && 
            stat.isFile() && result.push(name);
        
    };
    return list;
}

var parseCssToStyleSheet = function(cssContent){
    return CSSOM.parse(cssContent);
}

var splitStyleBackgound = function(style){
    
}

var pretreatAndCollectCSSRules = function(styleSheet, result){
    if(!styleSheet.cssRules.length){
        return;
    }
    if(!result){
        result = {
            cssRuleList: [], 
            imageNameList: []
        };
    }
    for(var i = 0, rule; rule = styleSheet.cssRules[i]; i++) {
        if(rule.cssRules && rule.cssRules.length){
            pretreatAndCollectCSSRules(rule);
            continue;
        }
        if(rule.style.background){//有 background 就先拆分
            splitStyleBackgound(rule.style);
        }
    }
}

var main = function(){
    var configFile = './config.json',
        config = readConfig(configFile),
        cssFileNameList = readFiles(config.cssRoot),
        cssContent,
        styleSheet,
        cssRuleList,
        imageNameList,
        temp;
    if(!cssFileNameList.length){
        console.log('there is no file in ' + config.cssRoot);
        return;
    }
    for(var i = 0, fileName; fileName = cssFileNameList[i]; i++) {
        cssContent = readFile(config.cssRoot + fileName);
        styleSheet = parseCssToStyleSheet(cssContent);
        temp = pretreatAndCollectCSSRules(styleSheet);
        cssRuleList = temp.cssRuleList, imageNameList = temp.imageNameList;
        // cssRuleList, imageNameList = pretreatAndCollectCSSRules(styleSheet), collectImages(styleSheet);
        // imageLinkList = readAndSortImages(imageNameList);
        // writeImage(newImageName, imageLinkList);
        // replaceAndPositionBackground(cssRuleList);
        // writeFile(newFileName, styleSheet);
    };
}

main();