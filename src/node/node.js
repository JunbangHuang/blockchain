'use strict';

const crypto = require('crypto');
var merkle = require('merkle-lib');
var merkleProof = require('merkle-lib/proof');
var bigInt = require('big-integer');

const utils = require('../utils/utils.js');
const {
  Block,
  Header
} = require('../block/block.js');

const MAXIMUM = 3;
const BLOCKTIME = 1; // 1 minute
const HISTORICALTIMELENGTH = 100; // in reality, it is 2016

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest()
}

function FullNode(ip, port) {
  this.ip = ip;
  this.port = port;
  this.blockchain = new Map();
}
FullNode.prototype.addBlock = function(block) {
  // assume all blocks are structurally validated
  const blockHash = utils.getBlockHash(block.header.toBuffer().toString('hex')).toString('hex');
  if (!this.blockchain.has(blockHash)) {
    this.blockchain.set(blockHash, block);
    // to-do: propagate block
  }
}

function Miner(ip, port) {
  FullNode.call(this, ip, port);
  this.blockchain = new Map();
  this.preBlock;
  this.block;
  this.transactionCache = new Map();
  this.stop = false;
  this.isStop = false;
  this.diff = 1;
  this.times = [];
  this.nonce = bigInt();
  this.target = bigInt(2).pow(256 - this.diff);
  this.merkleTree = null;
}
Miner.prototype = Object.create(FullNode.prototype);
Miner.prototype.constructor = Miner;
Miner.prototype.addBlock = function(block) {
  // assume all blocks are structurally validated
  const blockHash = utils.getBlockHash(block.header.toBuffer().toString('hex')).toString('hex');
  if (!this.blockchain.has(blockHash)) {
    // verify solution
    const hash = bigInt(crypto.createHash('sha256').update(block.header.nonce.toString('hex')).digest('hex'));
    if (hash.leq(this.target)) {
      this.blockchain.set(blockHash, block);
      // to-do: propagate block
      // stop this round
      this.stop = true;
      // clean cache
      block.getTransactions().forEach(function(tx) {
        const txHash = utils.getTransactionHash(tx.toBuffer().toString('hex'));
        if (this.transactionCache.has(txHash)) {
          this.transactionCache.delete(txHash);
        }
      });
      // start next round
      while (this.isStop) {
        // update difficulty
        var real = this.times.reduce((acc, val) => acc + val, 0);
        var ideal = this.times.length * BLOCKTIME;
        this.diff = parseInt(this.diff * real / ideal);
        this.mine();
      }
    }
  }
}
Miner.prototype.addTransaction = function(transaction) {
  // assume all transactions are structurally validated
  const tx = transaction.toBuffer().toString('hex');
  const txHash = utils.getTransactionHash(tx).toString('hex');
  if (!this.transactionCache.has(txHash)) {
    this.transactionCache.set(txHash, transaction);
    // create if not exist
    this.createBlock();
    // add if has space and not includes
    this.addTransactionToBlock(transaction);
  }
}
Miner.prototype.mine = function() {
  this.merkleTree = null;
  this.isStop = false;
  this.stop = false;
  this.block = null;
  this.start = parseInt(new Date().getTime() / 1000 / 60);
  // create if not exist
  this.createBlock();
  // add if has space and not includes
  this.transactionCache.forEach(function(transaction) {
    this.addTransactionToBlock(transaction);
  });


  // var hash = bigInt(crypto.createHash('sha256').update(this.nonce.toString()).digest('hex'));
  // // found a solution
  // if (hash.leq(this.target)) {
  //   const duration = parseInt(new Date().getTime() / 1000 / 60);
  //   this.block.header.setNonce(Buffer.from(this.nonce.toString()));
  //   this.blockHeader.setDiffTarget(Buffer.from(this.diff + ''));
  //   if (this.times.length == HISTORICALTIMELENGTH) {
  //     this.times.pop();
  //   }
  //   this.times.push(duration);
  //   // propagate
  //   break;
  // } else {
  //   this.nonce.add(1);
  // }

  this.isStop = true;
}
Miner.prototype.createBlock = function() {
  if (typeof this.block === 'undefined' || this.block === null) {
    var header = new Header();
    if (typeof this.preBlock === 'undefined') {
      var preBlockHash = utils.getBlockHash('Genesis Block');
      header.setPreBlockHash(preBlockHash);
    } else {
      var preBlock = this.preBlock.toBuffer().toString('hex');
      var preBlockHash = utils.getBlockHash(preBlock);
      header.setPreBlockHash(preBlockHash);
    }
    this.block = new Block(header);
  }
}
Miner.prototype.addTransactionToBlock = function(transaction) {
  // no transaction fee bias
  if (this.block.getTxCnt() < MAXIMUM) {
    if (this.merkleTree === null) {
      this.block.addTransaction(transaction);
      const txHashes = this.block.getTransactions().map(x => utils.getTransactionHash(x.toBuffer.toString('hex')).toString('hex'));
      this.merkleTree = merkle(txHashes, sha256);
      this.block.header.setMerkleRoot(Buffer.from(this.merkleTree[this.merkleTree.length - 1]));
    } else {
      const proof = merkleProof(this.merkleTree, txHash);
      if (!merkleProof.verify(proof, sha256)) {
        this.block.addTransaction(transaction);
        const txHashes = this.block.getTransactions().map(x => utils.getTransactionHash(x.toBuffer.toString('hex')).toString('hex'));
        this.merkleTree = merkle(txHashes, sha256);
        this.block.header.setMerkleRoot(Buffer.from(this.merkleTree[this.merkleTree.length - 1]));
      }
    }
  }
}

function Wallet(address) {
  this.address = address;
  this.uxto = [];
}


var exports = module.exports = {};
exports.FullNode = FullNode;
exports.Miner = Miner;
