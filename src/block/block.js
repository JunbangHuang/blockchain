'use script';

var merkle = require('merkle-lib');
var merkleProof = require('merkle-lib/proof');

const utils = require('../utils/utils.js');

const VERSION = '1';

function Block(header) {
  this.merkleTree = null;
  this.header = header;
  this.transactions = [];
  this.transactionsBuffer = [];
  // the merkle tree use Buffer object, which is immutable,
  // even with the same value, the object is not the same, therefore, use set here
  this.transactionsIds = new Set();
  this.txCnt = null;
  this.blockSize = null;
}
Block.prototype.contains = function(tx) {
  // not contains
  if (typeof this.merkleTree === 'undefined' || this.merkleTree === null) {
    return false;
  }
  const txHash = utils.getTransactionHash(JSON.stringify(tx));
  return this.transactionsIds.has(txHash);
}
Block.prototype.setBlockSize = function() {
  this.blockSize = this.getSize();
}
Block.prototype.addTransaction = function(transaction) {
  // push into block
  const txHash = utils.getTransactionHash(JSON.stringify(transaction));
  this.transactions.push(transaction);
  this.transactionsBuffer.push(new Buffer(txHash, 'hex'));
  this.transactionsIds.add(txHash);
  // update merkle tree
  this.merkleTree = merkle(this.transactionsBuffer, utils.sha256);
  // update merkle root
  this.header.setMerkleRoot(this.merkleTree[this.merkleTree.length - 1].toString('hex'));
};
Block.prototype.getTransactions = function() {
  return this.transactions;
};
Block.prototype.getPreBlockHash = function() {
  return this.header.preBlockHash;
}
Block.prototype.getTxCnt = function() {
  return this.transactions.length;
}
Block.prototype.getSize = function() {
  var size = this.header.getSize() + 2;
  this.transactions.forEach(function(tx) {
    size += tx.getSize();
  });
  return size;
}
Block.prototype.toBlock = function() {
  this.setBlockSize();
  this.txCnt = this.transactions.length;
  return {
    header: this.header,
    transactions: this.transactions,
    txCnt: this.txCnt,
    blockSize: this.blockSize
  };
}

function Header() {
  this.version = VERSION;
  this.timestamp = new Date().getTime().toString();
  this.merkleRoot = null;
  this.diffTarget = null;
  this.nonce = null;
}
Header.prototype.setPreBlockHash = function(preBlockHash) {
  this.preBlockHash = preBlockHash;
}
Header.prototype.setMerkleRoot = function(merkleRoot) {
  this.merkleRoot = merkleRoot;
}
Header.prototype.setDiffTarget = function(diffTarget) {
  this.diffTarget = diffTarget;
}
Header.prototype.setNonce = function(nonce) {
  this.nonce = nonce;
}
Header.prototype.getSize = function() {
  return this.version.length + this.preBlockHash.length + this.merkleRoot.length +
    this.diffTarget.length + this.nonce.length + this.timestamp.length;
}

var exports = module.exports = {};
exports.Header = Header;
exports.Block = Block;
