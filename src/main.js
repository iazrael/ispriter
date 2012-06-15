var fs = require('fs');

var main = function(){
    var configFile = './config.json';
    var param = readParam(configFile);
    var cssFileList = readFiles();
    for(var i = 0, fileName; fileName = cssFileList[i]; i++) {
        cssContent = readFile(fileName);
        styleSheet = CSSOM.parse(cssContent);
        cssRuleList, imageNameList = pretreatAndCollectCSSRules(styleSheet), collectImages(styleSheet);
        imageLinkList = readAndSortImages(imageNameList);
        writeImage(newImageName, imageLinkList);
        replaceAndPositionBackground(cssRuleList);
        writeFile(newFileName, styleSheet);
    };
}

var readParam = function(configFile){
    var content = fs.readFileSync(configFile).toString();
    var config = JSON.parse(content);
    return config;
}