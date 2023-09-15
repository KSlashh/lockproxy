const hre = require("hardhat");
const Web3 = require("web3");
const fs = require("fs");
hre.web3 = new Web3(hre.network.provider);
require("colors");

var configPath = './polyConfig.json'

async function main() {
    [admin] = await hre.ethers.getSigners();
    var config = {}
    await readConfig(hre.network.name).then((netConfig) => {
        if (netConfig === undefined) {
            console.error("unknown network: network config does not exisit".red);
            process.exit(1)
        }
        config = netConfig
    }).catch((err) => {
        console.error(err);
        process.exit(1);
    });
    if (config.EthCrossChainManagerProxy === undefined) {
        console.error("invalid network config: EthCrossChainManagerProxy does not exisit".red);
        process.exit(1)
    }
    
    const LockProxyPausable = await hre.ethers.getContractFactory("LockProxyPausable");
    let polyId = config.PolyChainID
    let lockproxy
    let ccmp = config.EthCrossChainManagerProxy
    
    console.log("\nDeploy LockProxyPausable on chain with Poly_Chain_Id:".cyan, polyId);
    
    if (config.LockProxyPausable === undefined) {
        // deploy LockProxyPausable
        console.log("\ndeploy LockProxyPausable ......".cyan);
        lockproxy = await LockProxyPausable.deploy();
        await lockproxy.deployed();
        console.log("LockProxyPausable deployed to:".green, lockproxy.address.blue);
        config.LockProxyPausable = lockproxy.address
        writeConfig(config)
    } else {
        console.log("\nLockProxyPausable already deployed at".green, config.LockProxyPausable.blue)
        lockproxy = await LockProxyPausable.attach(config.LockProxyPausable) 
    }

    let alreadySetCCMP = await lockproxy.managerProxyContract();
    if (alreadySetCCMP == ccmp) {
        console.log("managerProxyContract already set".green);
    } else {
        // setup LockProxyPausable
        console.log("\nsetup LockProxyPausable ......".cyan);
        tx = await lockproxy.setManagerProxy(ccmp);
        await tx.wait();
        console.log("setManagerProxy Done".green);
    }

    console.log("\nDone.\n".magenta);

    console.log("constract output:\n".cyan,config);
    await writeConfig(config)
    console.log("\nwrite config done\n".green);

    console.log("\nDone.\n".magenta);
}

async function readConfig(networkName) {
    let jsonData
    try {
        jsonData = fs.readFileSync(configPath)
    } catch(err) {
        if (err.code == 'ENOENT') {
            createEmptyConfig()
            return
        }else{
            console.error(err);
            process.exit(1);
        }
    }
    if (jsonData === undefined) {
        return
    }
    var json=JSON.parse(jsonData.toString())
    if (json.Networks === undefined) {
        return
    }
    for (let i=0; i<json.Networks.length; i++) {
        if (json.Networks[i].Name == networkName) {
            return json.Networks[i]
        }
    }
    // console.error("network do not exisit in config".red);
    // process.exit(1);
}

async function writeConfig(networkConfig) {
    if (networkConfig.Name === undefined) {
        console.error("invalid network config".red);
        process.exit(1);
    }
    let data=fs.readFileSync(configPath,(err,data)=>{
        if (err) {
            console.error(err);
            process.exit(1);
        }else{
          previous=data.toString();
        }  
    });
    var json = JSON.parse(data.toString())  
    var writeIndex = json.Networks.length 
    for (let i=0; i<json.Networks.length; i++) {
        if (json.Networks[i].Name == networkConfig.Name) {
            writeIndex = i
            break
        }
    }
    json.Networks[writeIndex] = networkConfig
    var jsonConfig = JSON.stringify(json,null,"\t")
    try {
        fs.writeFileSync(configPath, jsonConfig);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

function createEmptyConfig() {
    var json = {Networks: []}
    var jsonConfig = JSON.stringify(json,null,"\t")
    try {
        fs.writeFileSync(configPath, jsonConfig);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
      console.error(err)
      process.exit(1)
  });