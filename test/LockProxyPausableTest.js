const { ethers } = require("hardhat");
const hre = require("hardhat");
const fs = require("fs");
const crypto = require("crypto");
const { expect } = require("chai");
const bytes = require("@ethersproject/bytes");

describe("LockProxyPausable", async function () {

    let admin;
    let hub;
    let polyId_1 = 1;
    let polyId_2 = 2;
    let user_1;
    let user_2;
    let lockproxy_1;
    let lockproxy_2;
    let asset_1;
    let asset_2;

    describe("initialize", function () {
        it("Should do deployment", async function() {
            [admin, user_1, user_2] = await hre.ethers.getSigners();

            await hre.run('compile');

            // deploy Hub (Test version of EthCrossChainManagerProxy)
            const Hub = await hre.ethers.getContractFactory("Hub");
            hub = await Hub.deploy();
            await hub.deployed();

            // deploy LockProxy 
            const LockProxyPausable = await hre.ethers.getContractFactory("LockProxyPausable");
            lockproxy_1 = await LockProxyPausable.deploy();
            await lockproxy_1.deployed();
            lockproxy_2 = await LockProxyPausable.deploy();
            await lockproxy_2.deployed();

            // deploy test token
            const ERC20Pro = await hre.ethers.getContractFactory("ERC20Pro");
            asset_1 = await ERC20Pro.deploy("TestCoin","TC",6);
            await asset_1.deployed();
            asset_2 = await ERC20Pro.deploy("TestCoin","TC",6);
            await asset_2.deployed();

            // setup Hub
            await hub.connect(admin).bind(polyId_1, lockproxy_1.address);
            await hub.connect(admin).bind(polyId_2, lockproxy_2.address);

            // mint test token to LockProxy
            await asset_1.connect(admin).mint(lockproxy_1.address, 10000000000);
            await asset_2.connect(admin).mint(lockproxy_2.address, 10000000000);
        });

        it("Should setManagerProxy", async function() {
            await lockproxy_1.connect(admin).setManagerProxy(hub.address);
            expect(await lockproxy_1.managerProxyContract()).to.equal(hub.address);
            await lockproxy_2.connect(admin).setManagerProxy(hub.address);
            expect(await lockproxy_2.managerProxyContract()).to.equal(hub.address);
        });

        it("Should lock and unlock successfully", async function() {
            // bind 
            await lockproxy_1.connect(admin).bindProxyHash(polyId_2, lockproxy_2.address);
            await lockproxy_1.connect(admin).bindAssetHash(asset_1.address, polyId_2, asset_2.address);
            await lockproxy_2.connect(admin).bindProxyHash(polyId_1, lockproxy_1.address);
            await lockproxy_2.connect(admin).bindAssetHash(asset_2.address, polyId_1, asset_1.address);

            // mint 
            await asset_1.connect(admin).mint(user_1.address, 10000000000);
            // approve
            await asset_1.connect(user_1).approve(lockproxy_1.address, 10000000000);

            // lock
            user_2_balance_before = await asset_2.balanceOf(user_2.address);
            let amount = 2000000;
            await lockproxy_1.connect(user_1).lock(asset_1.address, polyId_2, user_2.address, amount);
            expect(await asset_2.balanceOf(user_2.address)).to.equal(Number(user_2_balance_before) + amount);
        });

        it("Lock should fail if source chain LockProxy is paused", async function() {
            // source chain pasue
            await lockproxy_1.connect(admin).pause();

            await expect(lockproxy_1.connect(user_1).lock(asset_1.address, polyId_2, user_2.address, 2000000)).to.be.revertedWith("Pausable: paused");

            // unpause
            await lockproxy_1.connect(admin).unpause();
        });

        it("Lock should fail if source chain toAsset not set", async function() {
            // source chain unbind asset
            await lockproxy_1.connect(admin).bindAssetHash(asset_1.address, polyId_2, "0x");

            await expect(lockproxy_1.connect(user_1).lock(asset_1.address, polyId_2, user_2.address, 2000000)).to.be.revertedWith("empty illegal toAssetHash");

            // rebind
            await lockproxy_1.connect(admin).bindAssetHash(asset_1.address, polyId_2, asset_2.address);
        });

        it("Lock should fail if source chain toProxy not set", async function() {
            // source chain unbind proxy
            await lockproxy_1.connect(admin).bindProxyHash(polyId_2, "0x");

            await expect(lockproxy_1.connect(user_1).lock(asset_1.address, polyId_2, user_2.address, 2000000)).to.be.revertedWith("empty illegal toProxyHash");

            // rebind
            await lockproxy_1.connect(admin).bindProxyHash(polyId_2, lockproxy_2.address);
        });

        it("Unlock should fail if target chain LockProxy paused", async function() {
            // target chain pasue
            await lockproxy_2.connect(admin).pause();

            await expect(lockproxy_1.connect(user_1).lock(asset_1.address, polyId_2, user_2.address, 2000000)).to.be.revertedWith("Pausable: paused");

            // unpause
            await lockproxy_2.connect(admin).unpause();
        });

        it("Unlock should fail if target chain toAsset not set", async function() {
            // target chain unbind asset
            await lockproxy_2.connect(admin).bindAssetHash(asset_2.address, polyId_1, "0x");

            await expect(lockproxy_1.connect(user_1).lock(asset_1.address, polyId_2, user_2.address, 2000000)).to.be.revertedWith("toAsset not bind");

            // rebind
            await lockproxy_2.connect(admin).bindAssetHash(asset_2.address, polyId_1,asset_1.address);
        });

        it("Unlock should fail if fromContract doesnt match", async function() {
            // target chain bind another lockproxy
            const LockProxyPausable = await hre.ethers.getContractFactory("LockProxyPausable");
            let lockproxy_3 = await LockProxyPausable.deploy()
            await lockproxy_2.connect(admin).bindProxyHash(polyId_1, lockproxy_3.address);

            await expect(lockproxy_1.connect(user_1).lock(asset_1.address, polyId_2, user_2.address, 2000000)).to.be.revertedWith("From Proxy contract address error!");

            // rebind
            await lockproxy_2.connect(admin).bindProxyHash(polyId_1, lockproxy_1.address);
        });
    });
});