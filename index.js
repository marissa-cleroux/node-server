const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');
const querystring = require('querystring');
const xml2js = require('xml2js').parseString;
const pug = require('pug');
const user = require('./user');

const WEBROOT = '../MClerouxC31A02root/public';
const DATAROOT = '../MClerouxC31A02data';
const ERROR_PATH = '../MClerouxC31A02root/errorpages';
const TEMPLATEROOT = '../MClerouxC31A02root/templates';
const DEFAULT_PAGE = 'index.html';
const PORT = 9000;
const EXTENSIONS = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js':'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.svg': 'image/svg+xml',
    '.xml': 'text/xml',
    '.txt': 'text/plain',
    '.ico': 'image/x-icon',
    '.json': 'application/json'
};

let sendResponse = (response, content, code, contentType, req, err) =>{
    response.writeHead(code, {
        'content-type': contentType,
        'content-length': content.length
    });
    response.end(content);

    logRequest(req, code, err);
};

let readInFile = (localpath, contentType, response, code, req, errMsg)=>{
    fs.readFile(localpath, (err, content)=> {
        if (!err) {
            sendResponse(response, content, code, contentType, req, errMsg)
        } else if (err.code === 'ENOENT') {
            readInFile(path.join(__dirname, ERROR_PATH, '404.html'), 'text/html', response, 404, req, err.message);
        } else {
            fs.readFile(path.join(__dirname, ERROR_PATH, '500.html'), (err2, contentErr) => {
                let errMsg = 'Internal Server Error: Your request cannot be handled at this time.';
                (!err2) ? sendResponse(response, contentErr, 500, 'text/html', req) : sendResponse(response, errMsg, 500, 'text/plain', req, err2.message);
            })
        }
    })
};

let logRequest = (requested, code, error) => {
    let localpath = path.join(__dirname, DATAROOT, 'logs/web.log');
    let date = new Date();
    let formattedDate = `${date.toLocaleDateString("en-ca")} ${date.toLocaleTimeString("en-ca", {hour12: true})}`;
    let log = `${formattedDate} ${requested} ${code}`;
    (error)? log += ` ${error}\n` : log += '\n';

    fs.appendFile(localpath, log, (err)=>{
        if(err){
            console.log('Error: Log file cannot be written to.');
        }
    });
};

let getCars = (obj, response, req) =>{
    let localpath = path.join(__dirname, DATAROOT, 'cars.json');

    fs.readFile(localpath, (err, content)=>{
        if(!err){
            let cars = findRecord(obj, JSON.parse(content), false);
            if(cars.length > 0){
                sendResponse(response, JSON.stringify(cars), 200, 'application/json');
            }else {
                let errMsg = 'No records found';
                readInFile(path.join(__dirname, ERROR_PATH, '416.html'), 'text/html', response, 416, req, errMsg);
            }
        } else {
            readInFile(path.join(__dirname, ERROR_PATH, '500.html'), 'text/html', response, 500, req, err.message);
        }
    });

};

let parseQuery = (query) =>{
    let obj = {};

    if(query.startsWith('/'))
        query = query.substring(1);

    if (query.endsWith('/'))
        query = query.substring(0, query.length - 1);

    let queryArr = query.split('/');

    if(queryArr.length === 3)
        obj[queryArr[1]] = queryArr[2];
    else
        obj = null;

    return obj;
};



let findRecord = (query, parsedJSON, stocks)=>{
    let searchProperty = Object.keys(query)[0];
    let matchingRecord = null;

    if(Object.keys(query).length > 1){
        matchingRecord = undefined;
    } else if(stocks){
        matchingRecord = parsedJSON.dataset.record.find(stock => {
            if(stock[searchProperty])
                return stock[searchProperty][0] === query[searchProperty];
        });
    } else if(searchProperty === 'cost') {
        matchingRecord = parsedJSON.filter(car => {
            return parseFloat(car[searchProperty]) <= parseFloat(query[searchProperty]);
        })
    } else {
        matchingRecord = parsedJSON.filter(car => {
            return car[searchProperty] == query[searchProperty];
        });

        //used == on purpose to also match for int values
    }

    return matchingRecord;

};

let renderStock = (record, response, req)=>{
    if(record){
        try {
            let stockTemplate = pug.compileFile(path.join(TEMPLATEROOT, 'stock.pug'));
            let templateContent = stockTemplate(record);

            sendResponse(response, templateContent, 200, 'text/html', req);
        } catch(errTemplate){
            let localpath = path.join(__dirname, ERROR_PATH, '500.html');
            readInFile(localpath, 'text/html', response, 500, req, errTemplate.message);
        }
    }else {
        let localpath = path.join(__dirname, ERROR_PATH, '416.html');
        let errMsg = 'No records found';
        readInFile(localpath, 'text/html', response, 416, req, errMsg);
    }
};

let parseXML = (localpath, query, response, req) =>{
    fs.readFile(localpath, (err, content)=>{
        if(!err){
            xml2js(content, (err2, result)=>{
                if(!err2){
                    let record = findRecord(query, result, true);
                    renderStock(record, response, req);
                }
                else{
                    let localpath = path.join(__dirname, ERROR_PATH, '500.html');
                    readInFile(localpath, 'text/html', response, 500, req, err2.message);
                }
            })
        } else {
            let localpath = path.join(__dirname, ERROR_PATH, '500.html');
            readInFile(localpath, 'text/html', response, 500, req, err.message);
        }
    });
};

let serveIcon = (localpath, response, ext, req) => {
    fs.access(localpath, (err)=> {
        if(err){
            response.writeHead(200, {
                'content-type': EXTENSIONS[ext]
            });
            response.end();
            logRequest(req, 200);
        } else {
            readInFile(localpath, EXTENSIONS[ext], response, 200, req);
        }
    });

};

let serveDefault = (urlObj, response, req)=>{
    let localpath = urlObj.path;
    let fileName = DEFAULT_PAGE;

    fs.access(path.join(__dirname, WEBROOT, localpath, fileName), (err) => {
        if (err) {
            fileName = 'default.html';
        }
        readInFile(path.join(__dirname, WEBROOT, localpath, fileName), 'text/html', response, 200, req);
    });
};

let addUser = (localpath, values, response, req, user) =>{
    fs.appendFile(localpath, values, (err)=>{
        if(!err){
            try {
                let userTemplate = pug.compileFile(path.join(TEMPLATEROOT, 'user.pug'));
                let templateContent = userTemplate(user.data);
                sendResponse(response, templateContent, 200, 'text/html', req);
            }catch(err2){
                localpath = path.join(__dirname, ERROR_PATH, '500.html');
                readInFile(localpath, 'text/html', response, 500, req, err2.message);
            }
        } else {
            try {
                let errorTemplate = pug.compileFile(path.join(TEMPLATEROOT, 'userError.pug'));
                let templateContent = errorTemplate({'error': err.message});
                sendResponse(response, templateContent, 520, 'text/html', req, err.message);
            }catch(err2){
                localpath = path.join(__dirname, ERROR_PATH, '500.html');
                readInFile(localpath, 'text/html', response, 500, req, err2.message);
            }
        }
    });
};

let handleBinRequest = (response, fileName, req, urlObj, ext)=>{
    if(ext !== '.xml'){
        let errMsg = 'Wrong file format';
        readInFile(path.join(__dirname, ERROR_PATH, '400.html'), EXTENSIONS['.html'], response, 400, req, errMsg);
    }else {

        let localpath = path.join(__dirname, DATAROOT, fileName);
        fs.access(localpath, (err) => {
            if (err)
                readInFile(path.join(__dirname, ERROR_PATH, '404.html'), EXTENSIONS['.html'], response, 404, req, err.message);
            else {
                if (!urlObj.query) {
                    let errMsg = 'No query entered';
                    readInFile(path.join(__dirname, ERROR_PATH, '406.html'), EXTENSIONS['.html'], response, 406, req, errMsg);
                } else {
                    let query = querystring.parse(urlObj.query);
                    parseXML(localpath, query, response, req);
                }
            }
        });
    }
};

let handleCarRequest = (response, fileName, req, urlObj) =>{
    if (urlObj.pathname === '/cars/') {
        let errMsg = 'No query entered';
        let localpath = path.join(__dirname, ERROR_PATH, '406.html');
        readInFile(localpath, EXTENSIONS['.html'], response, 406, req, errMsg);
    } else {
        let query = urlObj.pathname;
        query = decodeURIComponent(query);
        let obj = parseQuery(query);
        if (obj) {
            getCars(obj, response, req);
        } else {
            let errMsg = 'No record found';
            let localpath = path.join(__dirname, ERROR_PATH, '416.html');
            readInFile(localpath, EXTENSIONS['.html'], response, 416, req, errMsg);
        }
    }
};

http.createServer((request, response) =>{
    let urlObj = url.parse(request.url);
    let req = request.url;
    let pathObj = path.parse(urlObj.pathname);
    let fileName = pathObj.base || DEFAULT_PAGE;
    let ext = pathObj.ext;

    if(request.method === 'GET') {

        if (urlObj.pathname.startsWith('/bin/')) {
            handleBinRequest(response, fileName, req, urlObj, ext);
        } else if (urlObj.pathname.startsWith('/cars/')) {
            handleCarRequest(response, fileName, req, urlObj);
        } else if (!ext) {
            serveDefault(urlObj, response, req);
        } else if (ext === '.ico') {
            let localpath = path.join(__dirname, WEBROOT, pathObj.dir, fileName);
            serveIcon(localpath, response, ext, req);
        } else if (EXTENSIONS[ext]) {
            let type = EXTENSIONS[ext];
            let localpath = path.join(__dirname, WEBROOT, pathObj.dir, fileName);
            readInFile(localpath, type, response, 200, req);

        } else {
            let errMsg = 'Unhandled Request';
            let localpath = path.join(__dirname, ERROR_PATH, '415.html');
            readInFile(localpath, 'text/html', response, 415, req, errMsg);
        }
    } else if(request.method === 'POST'){
        let data = '';
        request.on('data', (chunk) =>{
            data += chunk;
        });

        request.on('end', ()=>{
            let parsedData = querystring.parse(data);
            let newUser = user.getInformation(parsedData);
            let values = newUser.getAllProperties().join(',');
            values += '\n';

            let localpath = path.join(__dirname, DATAROOT, 'user.txt');
            addUser(localpath, values, response, req, newUser);
        })
    }else {
        let errMsg = 'Unhandled method';
        let localpath = path.join(__dirname, ERROR_PATH, '501.html');
        readInFile(localpath, 'text/html', response, 501, req, errMsg);
    }
}).listen(PORT);
