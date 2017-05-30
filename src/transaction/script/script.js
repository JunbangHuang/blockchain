'use script';

const crypto = require('crypto');
const sha256 = crypto.createHash('sha256');
const ripemd160 = crypto.createHash('ripemd160');
var secp256k1 = require('secp256k1');

let OPTS = {
  OP_DUP: 'OP_DUP',
  OP_HASH160: 'OP_HASH160',
  OP_EQUAL: 'OP_EQUAL',
  OP_CHECKSIG: 'OP_CHECKSIG'
};

function Script() {
  this.list = [];
}
Script.prototype.getAll = function() {
  return this.list;
}
Script.prototype.get = function(idx) {
  return this.list[idx];
}
Script.prototype.setList = function(list) {
  this.list = list;
  this.length = list.length;
}

function createLockingScript(pubKeyHash) {
  var script = new Script();
  script.setList([Buffer.from(OPTS.OP_DUP), Buffer.from(OPTS.OP_HASH160),
    pubKeyHash, Buffer.from(OPTS.OP_EQUAL), Buffer.from(OPTS.OP_CHECKSIG)
  ]);
  return script;
}

function createUnlockingScript(sig, pubKey) {
  var script = new Script();
  script.setList([sig, pubKey]);
  return script;
}

function execute(msg, unlockingScript, lockingScript) {
  if (unlockingScript === null ||
    lockingScript === null ||
    unlockingScript.length !== 2 ||
    lockingScript.length !== 5) {
    return [false];
  }

  var stack = [];
  stack.push(unlockingScript.get(0));
  stack.push(unlockingScript.get(1));
  lockingScript.getAll().forEach(function(ele) {
    switch (ele.toString()) {
      case OPTS.OP_DUP:
        stack.push(stack[stack.length - 1]);
        break;
      case OPTS.OP_HASH160:
        var digest = sha256.update(stack.pop()).digest('hex');
        digest = ripemd160.update(digest).digest('hex')
        stack.push(digest);
        break;
      case OPTS.OP_EQUAL:
        var pubKeyHash1 = stack.pop();
        var pubKeyHash2 = stack.pop();
        if (pubKeyHash1 !== pubKeyHash2) {
          return [false];
        }
        break;
      case OPTS.OP_CHECKSIG:
        var pubKey = stack.pop();
        var sig = stack.pop();
        if (!secp256k1.verify(msg, sig, pubKey)) {
          return [false];
        } else {
          stack.push(true);
        }
        break;
      default:
        stack.push(ele);
        break;
    }
  });

  return stack;
}

var exports = module.exports = {};
exports.Script = Script;
exports.createLockingScript = createLockingScript;
exports.createUnlockingScript = createUnlockingScript;
exports.execute = execute;