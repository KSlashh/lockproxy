const { ethers } = require("hardhat");
const hre = require("hardhat");
const fs = require("fs");
const crypto = require("crypto");
const { expect } = require("chai");
const bytes = require("@ethersproject/bytes");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("LockProxyLimited", async function () {

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
            const LockProxyLimited = await hre.ethers.getContractFactory("LockProxyLimited");
            lockproxy_1 = await LockProxyLimited.deploy();
            await lockproxy_1.deployed();
            lockproxy_2 = await LockProxyLimited.deploy();
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

        it("Should fail if quota not set", async function() {
            // bind 
            await lockproxy_1.connect(admin).bindProxyHash(polyId_2, lockproxy_2.address);
            await lockproxy_1.connect(admin).bindAssetHash(asset_1.address, polyId_2, asset_2.address);
            await lockproxy_2.connect(admin).bindProxyHash(polyId_1, lockproxy_1.address);
            await lockproxy_2.connect(admin).bindAssetHash(asset_2.address, polyId_1, asset_1.address);

            // mint 
            await asset_1.connect(admin).mint(user_1.address, 10000000000);
            // approve
            await asset_1.connect(user_1).approve(lockproxy_1.address, 10000000000);

            await expect(lockproxy_1.connect(user_1).lock(asset_1.address, polyId_2, user_2.address, 2000000)).to.be.revertedWith("limit reached");
        });

        it("Should unlock successfully if within limit", async function() {
            lockproxy_2.connect(admin).setQuota(asset_2.address, 5000000);
            lockproxy_2.connect(admin).setRefreshPeriod(asset_2.address, 10000);

            user_2_balance_before = await asset_2.balanceOf(user_2.address);
            let amount = 2000000;
            await lockproxy_1.connect(user_1).lock(asset_1.address, polyId_2, user_2.address, amount);
            expect(await asset_2.balanceOf(user_2.address)).to.equal(Number(user_2_balance_before) + amount);
        });

        it("Should fail if limit reached", async function() {
            await expect(lockproxy_1.connect(user_1).lock(asset_1.address, polyId_2, user_2.address, 7000000)).to.be.revertedWith("limit reached");
        });

        it("Should refresh successfully", async function() {
            lockproxy_2.connect(admin).setQuota(asset_2.address, 5000000);
            lockproxy_2.connect(admin).setRefreshPeriod(asset_2.address, 0);
            lockproxy_2.connect(admin).setRefreshPeriod(asset_2.address, 10000);

            await lockproxy_1.connect(user_1).lock(asset_1.address, polyId_2, user_2.address, 3000000);
            await expect(lockproxy_1.connect(user_1).lock(asset_1.address, polyId_2, user_2.address, 3000000)).to.be.revertedWith("limit reached");

            let lastRefreshTime = await lockproxy_2.connect(admin).refreshTimestamp(asset_2.address);
            await time.increaseTo(Number(lastRefreshTime)+10001);

            user_2_balance_before = await asset_2.balanceOf(user_2.address);
            await lockproxy_1.connect(user_1).lock(asset_1.address, polyId_2, user_2.address, 3000000);
            expect(await asset_2.balanceOf(user_2.address)).to.equal(Number(user_2_balance_before) + 3000000);
        });
    });
});