const { ethers } = require("hardhat");
const hre = require("hardhat");
const fs = require("fs");
const crypto = require("crypto");
const { expect } = require("chai");
const bytes = require("@ethersproject/bytes");

describe("LockProxyReviewable", async function () {

    let admin;
    let hub;
    let polyId_1 = 1;
    let polyId_2 = 2;
    let user_1;
    let user_2;
    let censor;
    let lockproxy_1;
    let lockproxy_2;
    let asset_1;
    let asset_2;

    describe("initialize", function () {
        it("Should do deployment", async function() {
            [admin, user_1, user_2, censor] = await hre.ethers.getSigners();

            await hre.run('compile');

            // deploy Hub (Test version of EthCrossChainManagerProxy)
            const Hub = await hre.ethers.getContractFactory("Hub");
            hub = await Hub.deploy();
            await hub.deployed();

            // deploy LockProxy 
            const LockProxyReviewable = await hre.ethers.getContractFactory("LockProxyReviewable");
            lockproxy_1 = await LockProxyReviewable.deploy();
            await lockproxy_1.deployed();
            lockproxy_2 = await LockProxyReviewable.deploy();
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

        it("Should lock and unlock successfully within limit", async function() {
            // bind 
            await lockproxy_1.connect(admin).bindProxyHash(polyId_2, lockproxy_2.address);
            await lockproxy_1.connect(admin).bindAssetHash(asset_1.address, polyId_2, asset_2.address);
            await lockproxy_2.connect(admin).bindProxyHash(polyId_1, lockproxy_1.address);
            await lockproxy_2.connect(admin).bindAssetHash(asset_2.address, polyId_1, asset_1.address);

            // set limit
            let limit = 5000000;
            await lockproxy_2.connect(admin).setLimitForToken(asset_2.address, limit);

            // set censor
            await lockproxy_2.connect(admin).addCensor(censor.address);

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

        it("Should create unlock request when exceed limit", async function() {
            user_2_balance_before = await asset_2.balanceOf(user_2.address);
            latestRequestId_before = await lockproxy_2.latestRequestId();
            let amount = 6000000;
            await lockproxy_1.connect(user_1).lock(asset_1.address, polyId_2, user_2.address, amount);
            expect(await asset_2.balanceOf(user_2.address)).to.equal(Number(user_2_balance_before));
            expect(await lockproxy_2.latestRequestId()).to.equal(Number(latestRequestId_before) + 1);
        });

        it("Should fail to approve whith invalid TxArgs", async function () {
            let requestId = await lockproxy_2.latestRequestId();
            let to_asset = asset_2.address;
            let to_address = user_2.address;
            let amount = 6000000;
            await expect(lockproxy_2.connect(censor).approve(requestId, to_asset, to_address, amount+1)).to.be.revertedWith("invalid TxArgs");
            await expect(lockproxy_2.connect(censor).approve(requestId, asset_1.address, to_address, amount)).to.be.revertedWith("invalid TxArgs");
            await expect(lockproxy_2.connect(censor).approve(requestId, to_asset, user_1.address, amount+1)).to.be.revertedWith("invalid TxArgs");
        });

        it("Should approve successfully with correct args", async function () {
            let requestId = await lockproxy_2.latestRequestId();
            let to_asset = asset_2.address;
            let to_address = user_2.address;
            let amount = 6000000;
            user_2_balance_before = await asset_2.balanceOf(user_2.address);
            await lockproxy_2.connect(censor).approve(requestId, to_asset, to_address, amount);
            expect(await asset_2.balanceOf(user_2.address)).to.equal(Number(user_2_balance_before) + amount);
        });

        it("Should fail to approve request which is already settled", async function() {
            let requestId = await lockproxy_2.latestRequestId();
            let to_asset = asset_2.address;
            let to_address = user_2.address;
            let amount = 6000000;
            await expect(lockproxy_2.connect(censor).approve(requestId, to_asset, to_address, amount)).to.be.revertedWith("this is not a pending request");
        });

        it("Should test ban/unabn/removeBannedRequest", async function() {
            let amount = 6000000;
            await lockproxy_1.connect(user_1).lock(asset_1.address, polyId_2, user_2.address, amount);
            let requestId = await lockproxy_2.latestRequestId();
            let to_asset = asset_2.address;
            let to_address = user_2.address;

            // test ban
            await lockproxy_2.connect(censor).ban(requestId, "just for test");
            await expect(lockproxy_2.connect(censor).approve(requestId, to_asset, to_address, amount)).to.be.revertedWith("this is not a pending request");

            // test unban
            user_2_balance_before = await asset_2.balanceOf(user_2.address);
            await lockproxy_2.connect(censor).unban(requestId, "test", to_asset, to_address, amount);
            expect(await asset_2.balanceOf(user_2.address)).to.equal(Number(user_2_balance_before) + amount);

            // test remove banned request
            await lockproxy_1.connect(user_1).lock(asset_1.address, polyId_2, user_2.address, amount);
            requestId = await lockproxy_2.latestRequestId();
            await lockproxy_2.connect(censor).ban(requestId, "just for test");
            lockproxy_2.connect(admin).removeBannedRequest(requestId);
            await expect(lockproxy_2.connect(censor).approve(requestId, to_asset, to_address, amount)).to.be.revertedWith("this is not a pending request");
            await expect(lockproxy_2.connect(censor).unban(requestId, "test", to_asset, to_address, amount)).to.be.revertedWith("this is not a banned request");
        });

    });
});