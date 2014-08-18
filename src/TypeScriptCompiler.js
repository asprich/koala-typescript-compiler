/**
 * TypeScriptCompiler module
 */

'use strict';

var fs          = require('fs-extra'),
    path        = require('path'),
    util        = require('../util.js'),
    FileManager = global.getFileManager(),
    Compiler    = require(FileManager.appScriptsDir + '/Compiler.js');

/**
 * TypeScript Compiler
 * @param {object} settings The Current Compiler Settings
 */
function TypeScriptCompiler(config) {
   Compiler.call(this, config);
}
require('util').inherits(TypeScriptCompiler, Compiler);

module.exports = TypeScriptCompiler;

/**
 * compile coffee file
 * @param  {Object} file    compile file object
 * @param  {Object} emitter  compile event emitter
 */
TypeScriptCompiler.prototype.compile = function (file, emitter) {
    var exec     = require('child_process').exec,
        self     = this,
        filePath = file.src,
        output   = file.output,
        options  = file.settings,
        pcfg     = this.getProjectById(file.pid).config, //get project config
        argv     = [];

    //custom options
    var customOptions = pcfg.customOptions;
    if (Array.isArray(customOptions)) {
        argv = argv.concat(customOptions);
    }

    argv.push('--compile');

    if (options.sourceMap) {
        argv.push('--sourcemap');
    }

    //if (options.bare) {
    //    argv.push('--bare');
    //}
    //
    //if (options.literate) {
    //    argv.push('--literate');
    //}
    
    if (options.removeComments) {
        argv.push('--removeComments');
    }

    argv.push(path.basename(filePath));

    var triggerError = function (message) {
        emitter.emit('fail');
        emitter.emit('always');
        self.throwError(message, filePath);
    };

    var triggerSuccess = function () {
        emitter.emit('done');
        emitter.emit('always');
    }

    var globalSettings = this.getGlobalSettings(),
        tsPath = globalSettings.advanced.commandPath || 'tsc';
        
    if (tsPath.match(/ /)) {
        tsPath = '"'+ tsPath +'"';
    }

    var execOpts = {
        timeout: 5000,
        cwd: path.dirname(filePath)
    };
    
    // fix #129 env: node: No such file or directory
    if (process.platform === 'darwin') {
        execOpts.env = {
            PATH: "/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin/"
        }
    }
    
    exec([tsPath].concat(argv).join(' '), execOpts, function (error, stdout, stderr) {
        if (error !== null) {
            triggerError(stderr);
        } else {
            //move the result js file to output path
            if (path.dirname(filePath) === path.dirname(output)) {
                if (path.basename(filePath, '.ts') !== path.basename(output, '.js')) {
                    moveResutToOutput();
                } else {
                    triggerSuccess();
                }
            } else {
                moveResutToOutput();
            }
        }
    });

    //move file
    function moveResutToOutput() {
        var result = path.join(path.dirname(filePath), path.basename(filePath, '.ts') + '.js');

        fs.rename(result, output, function (err) {
            if (err) {
                triggerError(err.message);
            } else {
                triggerSuccess();
            }
        });

        // source map
        if (options.sourceMap) {
            var sourceMap = path.basename(filePath, '.ts') + '.map',
                sourceMapFullPathOfSrc = path.join(path.dirname(filePath), sourceMap),
                sourceMapFullPathDest = path.join(path.dirname(output), sourceMap);

            fs.rename(sourceMapFullPathOfSrc, sourceMapFullPathDest, function () {
                var sourceMapObj = util.readJsonSync(sourceMapFullPathDest);
            
                if (typeof(sourceMapObj) === 'object' && sourceMapObj.hasOwnProperty('sourceRoot')) {
                    sourceMapObj.sourceRoot = path.relative(path.dirname(sourceMapFullPathDest), path.dirname(sourceMapFullPathOfSrc));
                }

                fs.outputFile(sourceMapFullPathDest, JSON.stringify(sourceMapObj, null, '\t')); 
            });
        }
    }
};
