import axios from 'axios';
import fs from 'fs/promises';
import { existsSync, mkdirSync, rmSync } from 'fs';
import readline from 'readline';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { createCanvas, registerFont } from 'canvas';
import { ethers } from 'ethers';
import chalk from 'chalk';
import cfonts from 'cfonts';
import ora from 'ora';

// --- SETUP ---
const generatedInvoicesDir = './generated_invoices';

if (existsSync(generatedInvoicesDir)) {
    rmSync(generatedInvoicesDir, { recursive: true, force: true });
    console.log(chalk.yellow('Cleared previously generated invoices.'));
}
mkdirSync(generatedInvoicesDir, { recursive: true });
// ---------------------------------------------------

const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
];

function delay(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function countdown(ms) {
  const seconds = Math.floor(ms / 1000);
  const spinner = ora().start();
  for (let i = seconds; i > 0; i--) {
    spinner.text = chalk.gray(` Waiting ${i} Seconds Before Next Upload...`);
    await delay(1);
  }
  spinner.stop();
}

function generateRandomFilename() {
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `invoice_user-${randomStr}.png`;
}

function centerText(text, color = 'yellowBright') {
  const terminalWidth = process.stdout.columns || 80;
  const textLength = text.length;
  const padding = Math.max(0, Math.floor((terminalWidth - textLength) / 2));
  return ' '.repeat(padding) + chalk[color](text);
}

function shorten(str, frontLen = 6, backLen = 4) {
  if (!str || str.length <= frontLen + backLen) return str;
  return `${str.slice(0, frontLen)}....${str.slice(-backLen)}`;
}

async function readPrivateKeys() {
  try {
    const data = await fs.readFile('pk.txt', 'utf-8');
    return data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  } catch (error) {
    console.error(chalk.red(`Error reading pk.txt: ${error.message}`));
    return [];
  }
}

async function readProxies() {
  try {
    const data = await fs.readFile('proxy.txt', 'utf-8');
    const proxies = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (proxies.length === 0) {
      console.log(chalk.yellow('File proxy.txt is empty. Continuing without proxy.'));
    }
    return proxies;
  } catch (error) {
    console.log(chalk.yellow('File proxy.txt not found. Continuing without proxy.'));
    return [];
  }
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

function getHeaders(token = '') {
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    return {
      'User-Agent': randomUserAgent,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Content-Type': 'application/json',
      'Origin': 'https://app.polyflow.tech',
      'Referer': 'https://app.polyflow.tech/',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site',
      'Authorization': `Bearer ${token}`
    };
}

function getAxiosConfig(token = null, proxy = null) {
  const config = {
    headers: getHeaders(token),
  };
  if (proxy) {
    if (proxy.startsWith('http://') || proxy.startsWith('https://')) {
      config.httpsAgent = new HttpsProxyAgent(proxy);
    } else if (proxy.startsWith('socks4://') || proxy.startsWith('socks5://')) {
      config.httpsAgent = new SocksProxyAgent(proxy);
    }
  }
  return config;
}

async function getPublicIP(proxy) {
  try {
    const config = proxy ? { httpsAgent: proxy.startsWith('http') ? new HttpsProxyAgent(proxy) : new SocksProxyAgent(proxy) } : {};
    const response = await axios.get('https://api.ipify.org?format=json', config);
    return response.data.ip;
  } catch (error) {
    return 'Error getting IP';
  }
}

async function getToken(privateKey, proxy) {
  const spinner = ora('Login Process...').start();
  try {
    const wallet = new ethers.Wallet(privateKey);
    const address = wallet.address;
    const response = await axios.get(
      `https://api-v2.polyflow.tech/api/account/sign_content?address=${address}`,
      getAxiosConfig(null, proxy)
    );
    const content = response.data.msg.content;
    const signature = await wallet.signMessage(content);
    const loginResponse = await axios.post(
      'https://api-v2.polyflow.tech/api/account/login',
      {
        address,
        signature,
        chain_id: 1,
        referral_code: "FF933E6E64"
      },
      getAxiosConfig(null, proxy)
    );
    const token = loginResponse.data.msg.token;
    spinner.succeed(chalk.greenBright('Login Successfully'));
    return token;
  } catch (error) {
    const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
    spinner.fail(chalk.redBright(`Login Error: ${errorMessage}`));
    return null;
  }
}

async function getAccountInfo(token, proxy) {
  const spinner = ora('Getting Account Info...').start();
  try {
    const response = await axios.get('https://api-v2.polyflow.tech/api/user', getAxiosConfig(token, proxy));
    const data = response.data.msg;
    spinner.succeed(chalk.greenBright('Account Info Received'));
    return { addres: data.address, accountId: data.account_id };
  } catch (error) {
    const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
    spinner.fail(chalk.redBright(`Failed Reading Account: ${errorMessage}`));
    return null;
  }
}

async function createReceiptImage(receiptData) {
    const width = 500;
    const height = 350;
    const canvasObj = createCanvas(width, height);
    const ctx = canvasObj.getContext('2d');
    const { merchant_name, amount, currency, receipt_number } = receiptData.detail;
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    const dateString = now.toLocaleDateString('en-GB');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText(merchant_name, width / 2, 50);
    ctx.font = '18px "Courier New"';
    ctx.fillText(`Date: ${dateString}`, width / 2, 80);
    ctx.fillText(`Time: ${timeString}`, width / 2, 105);
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.setLineDash([5, 3]);
    ctx.moveTo(20, 130);
    ctx.lineTo(width - 20, 130);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillText('Crypto Transaction', 20, 160);
    ctx.textAlign = 'right';
    ctx.fillText(`${amount.toFixed(2)} ${currency}`, width - 20, 160);
    ctx.textAlign = 'center';
    ctx.fillText('-----------------------------------', width / 2, 190);
    ctx.font = 'bold 20px "Courier New"';
    ctx.textAlign = 'left';
    ctx.fillText('TOTAL', 20, 220);
    ctx.textAlign = 'right';
    ctx.fillText(`${amount.toFixed(2)} ${currency}`, width - 20, 220);
    ctx.textAlign = 'center';
    ctx.font = '14px "Courier New"';
    ctx.fillText('Receipt No:', width / 2, 260);
    ctx.fillText(shorten(receipt_number, 15, 15), width / 2, 280);
    ctx.font = 'bold 20px "Courier New"';
    ctx.fillText('** THANK YOU **', width / 2, 320);
    return canvasObj.toBuffer('image/png');
}

// MODIFICATION: Rombak total fungsi ini agar sesuai contoh
async function createWalletScreenshotImage(receiptData) {
    const width = 400;
    const height = 380;
    const canvasObj = createCanvas(width, height);
    const ctx = canvasObj.getContext('2d');
    const { amount, currency } = receiptData.detail;
    
    // Data acak untuk tampilan
    const fromAddress = ethers.Wallet.createRandom().address;
    const toAddress = ethers.Wallet.createRandom().address;
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });
    const dateString = now.toLocaleDateString('en-CA').replace(/-/g, '/');
    const networkFee = (Math.random() * 0.00009 + 0.00001).toFixed(8);
    const networkFeeUSD = (networkFee * 3500).toFixed(4); // Perkiraan harga ETH
    
    // Warna acak untuk ikon koin
    const colors = ['#F6851B', '#627EEA', '#41B883', '#F0B90B', '#8A2BE2'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    // Latar belakang gelap
    ctx.fillStyle = '#18191A';
    ctx.fillRect(0, 0, width, height);

    // Header
    ctx.fillStyle = '#E4E6EB';
    ctx.font = '16px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✔ Completed', width / 2, 40);

    // Ikon koin
    ctx.beginPath();
    ctx.arc(140, 90, 20, 0, 2 * Math.PI, false);
    ctx.fillStyle = randomColor;
    ctx.fill();

    // Jumlah
    ctx.fillStyle = '#E4E6EB';
    ctx.font = 'bold 32px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`+ ${amount.toFixed(0)} ${currency}`, 175, 100);

    // Garis pemisah
    ctx.strokeStyle = '#3A3B3C';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, 130);
    ctx.lineTo(width - 30, 130);
    ctx.stroke();

    // Detail From & To
    ctx.font = '14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#B0B3B8';
    ctx.fillText('From', 30, 160);
    ctx.fillText('Interacted with', 30, 210);

    ctx.font = '14px "Courier New", monospace';
    ctx.fillStyle = '#E4E6EB';
    ctx.fillText(fromAddress, 30, 180);
    ctx.fillText(toAddress, 30, 230);
    
    // Detail Bawah
    ctx.font = '14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#B0B3B8';
    ctx.fillText('Time', 30, 260);
    ctx.textAlign = 'right';
    ctx.fillText('Type', width - 30, 260);

    ctx.fillStyle = '#E4E6EB';
    ctx.textAlign = 'left';
    ctx.fillText(`${dateString}, ${timeString}`, 30, 280);
    ctx.textAlign = 'right';
    ctx.fillText('Contract Interaction', width - 30, 280);
    
    // Network Fee
    ctx.fillStyle = '#B0B3B8';
    ctx.textAlign = 'left';
    ctx.fillText('Network fee', 30, 310);
    ctx.textAlign = 'right';
    ctx.fillText('Network', width - 30, 310);

    ctx.fillStyle = '#E4E6EB';
    ctx.textAlign = 'left';
    ctx.fillText(`${networkFee} BASE_ETH`, 30, 330);
    ctx.fillStyle = '#B0B3B8';
    ctx.fillText(`($${networkFeeUSD})`, 30, 350);
    ctx.fillStyle = '#E4E6EB';
    ctx.textAlign = 'right';
    ctx.fillText('Base', width - 30, 330);

    return canvasObj.toBuffer('image/png');
}


async function createReceiptData() {
    const amount = (Math.random() * (50 - 1) + 1);
    const receiptNumber = `0x${[...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    // MODIFICATION: Nama merchant yang lebih umum
    const merchantNames = ["Pixel Palace", "Token Store", "DeFi Goods", "Web3 Wares", "CryptoMerch", "NFT Emporium", "Chain Goods"];
    const currencies = ["KRNL", "BUBU", "PXL", "USDT", "ETH", "MATIC", "BNB", "OP", "ARB"];

    const receiptData = {
        is_roam: false,
        is_confirmed: true,
        detail: {
            receipt_type: "crypto",
            merchant_name: merchantNames[Math.floor(Math.random() * merchantNames.length)],
            amount: Number(amount.toFixed(2)),
            currency: currencies[Math.floor(Math.random() * currencies.length)],
            receipt_number: receiptNumber,
            country_iso2: "ID",
            state_id: 1805,
            city_id: 154472
        }
    };

    return receiptData;
}

async function getPresignedUrl(filename, token, proxy) {
  try {
    const response = await axios.get(`https://api-v2.polyflow.tech/api/scan2earn/get_presigned_url?file_name=${filename}`, getAxiosConfig(token, proxy));
    return response.data.msg;
  } catch (error) {
    return null;
  }
}

async function uploadFile(presignedUrl, buffer, proxy) {
  try {
    const config = proxy ? { httpsAgent: proxy.startsWith('http') ? new HttpsProxyAgent(proxy) : new SocksProxyAgent(proxy) } : {};
    config.headers = { 'Content-Type': 'application/octet-stream' };
    const response = await axios.put(presignedUrl, buffer, config);
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

async function completeDailyTask(token, proxy) {
    const mainSpinner = ora('Checking daily tasks...').start();
    try {
        const response = await axios.get('https://api-v2.polyflow.tech/api/account/personalcenter/quests/daily', getAxiosConfig(token, proxy));
        const tasks = response.data.msg.quests.filter(t => t.status !== 'Completed');
        if (tasks.length === 0) { mainSpinner.info(chalk.yellowBright('No new daily tasks to complete.')); return; }
        mainSpinner.succeed(chalk.greenBright(`Found ${tasks.length} daily task(s) to complete.`));
        for (const task of tasks) {
            if (task.id === 6) { ora().info(chalk.yellow(`Skipping task: ${task.title}`)); continue; }
            const taskSpinner = ora(`→ Completing daily task: ${task.title}`).start();
            try {
                const taskResponse = await axios.post('https://api-v2.polyflow.tech/api/account/personalcenter/quests/complete', { quest_id: task.id }, getAxiosConfig(token, proxy));
                if (taskResponse.data.success) {
                    taskSpinner.succeed(chalk.greenBright(`Task '${task.title}' OK. Points: ${taskResponse.data.msg.points}`));
                } else {
                    taskSpinner.fail(chalk.redBright(`Task '${task.title}' failed: ${taskResponse.data.msg?.message || 'Unknown reason'}`));
                }
            } catch (taskError) {
                taskSpinner.fail(chalk.redBright(`Task '${task.title}' failed: ${taskError.response ? JSON.stringify(taskError.response.data) : taskError.message}`));
            }
        }
    } catch (error) {
        mainSpinner.fail(chalk.redBright(`Failed to fetch daily tasks: ${error.response ? JSON.stringify(error.response.data) : error.message}`));
    }
}

async function completeTutorialTask(token, proxy) {
    const mainSpinner = ora('Checking tutorial tasks...').start();
    try {
        const response = await axios.get('https://api-v2.polyflow.tech/api/account/personalcenter/quests/tutorial', getAxiosConfig(token, proxy));
        const tasks = response.data.msg.list.filter(t => t.campaign_status !== 'Completed');
        if (tasks.length === 0) { mainSpinner.info(chalk.yellowBright('No new tutorial tasks to complete.')); return; }
        mainSpinner.succeed(chalk.greenBright(`Found ${tasks.length} tutorial task(s) to complete.`));
        for (const task of tasks) {
            if (task.id === 9) { ora().info(chalk.yellow(`Skipping task: ${task.title}`)); continue; }
            const taskSpinner = ora(`→ Completing tutorial task: ${task.title}`).start();
            try {
                const taskResponse = await axios.post('https://api-v2.polyflow.tech/api/account/personalcenter/quests/complete', { quest_id: task.id }, getAxiosConfig(token, proxy));
                if (taskResponse.data.success && taskResponse.data.msg.message === "Tutorial quest completed successfully") {
                    taskSpinner.succeed(chalk.greenBright(`Task '${task.title}' OK. Points: ${taskResponse.data.msg.points}`));
                } else {
                    taskSpinner.fail(chalk.redBright(`Task '${task.title}' failed: ${taskResponse.data.msg?.message || 'Unknown reason'}`));
                }
            } catch (taskError) {
                taskSpinner.fail(chalk.redBright(`Task '${task.title}' failed: ${taskError.response ? JSON.stringify(taskError.response.data) : taskError.message}`));
            }
        }
    } catch (error) {
        mainSpinner.fail(chalk.redBright(`Failed to fetch tutorial tasks: ${error.response ? JSON.stringify(error.response.data) : error.message}`));
    }
}

async function claimbonus(token, proxy) {
  const spinner = ora('Claiming Daily Bonus...').start();
  try {
    const response = await axios.post('https://api-v2.polyflow.tech/api/account/personalcenter/quests/daily/claim-reward', {}, getAxiosConfig(token, proxy));
    const message = response.data.msg.message || '';
    if (message.includes('already')) {
      spinner.info(chalk.yellowBright('Daily Bonus Already Claimed'));
    } else if (message.includes('claimed successfully')) {
      spinner.succeed(chalk.greenBright(`Daily Bonus Claimed Successfully! Points: ${response.data.msg.points || 0}`));
    } else {
        spinner.warn(chalk.gray(`Daily Bonus Status: ${message}`));
    }
  } catch (error) {
    spinner.fail(chalk.redBright(`Error Claiming Daily Bonus: ${error.response ? JSON.stringify(error.response.data.msg) : error.message}`));
  }
}

async function showTotalPoints(token, proxy) {
  const spinner = ora('Getting Points Info...').start();
  try {
    const response = await axios.get('https://api-v2.polyflow.tech/api/account/personalcenter/dashboard', getAxiosConfig(token, proxy));
    spinner.succeed(chalk.greenBright(`Total Points: ${response.data.msg.total_points}`));
  } catch (error) {
    spinner.fail(chalk.redBright(`Error getting points: ${error.response ? JSON.stringify(error.response.data) : error.message}`));
  }
}

async function processAccount(privateKey, proxy, performUpload, uploadCount) {
  const token = await getToken(privateKey, proxy);
  if (!token) return;
  const accountInfo = await getAccountInfo(token, proxy);
  if (!accountInfo) return;

  const { addres, accountId } = accountInfo;
  console.log();
  console.log(chalk.bold.whiteBright(`Address          : ${shorten(addres)}`));
  console.log(chalk.bold.whiteBright(`Account ID       : ${accountId}`));
  const ip = await getPublicIP(proxy);
  console.log(chalk.bold.whiteBright(`IP Used          : ${ip}`));
  console.log(chalk.bold.cyanBright('='.repeat(80)));
  console.log();

  if (performUpload) {
    for (let j = 0; j < uploadCount; j++) {
        const uploadSpinner = ora(`Submitting Invoice ${j + 1}/${uploadCount}...`).start();
        try {
          uploadSpinner.text = 'Step 1: Generating receipt data...';
          const receiptData = await createReceiptData();

          uploadSpinner.text = 'Step 2: Generating random image type...';
          const imageType = Math.random() < 0.5 ? 'receipt' : 'wallet';
          const imageBuffer = imageType === 'receipt' 
              ? await createReceiptImage(receiptData) 
              : await createWalletScreenshotImage(receiptData);

          const filename = generateRandomFilename();
          const filePath = `${generatedInvoicesDir}/${filename}`;
          await fs.writeFile(filePath, imageBuffer);
          uploadSpinner.text = `Step 2: Generating image (${imageType})... (Saved to ${filePath})`;

          uploadSpinner.text = 'Step 3: Getting Presigned URL...';
          const presignedData = await getPresignedUrl(filename, token, proxy);
          if (!presignedData) throw new Error('Failed to get Presigned URL');
          
          uploadSpinner.text = 'Step 4: Uploading generated image...';
          const uploaded = await uploadFile(presignedData.presigned_url, imageBuffer, proxy);
          if (!uploaded) throw new Error('Uploading file failed');
    
          const invoicePath = presignedData.key;
    
          uploadSpinner.text = 'Step 5: Initial receipt parse...';
          await axios.post('https://api-v2.polyflow.tech/api/scan2earn/parse_receipt', {
              is_roam: false,
              invoice_path: invoicePath,
              is_confirmed: false,
              detail: { qr_code_msg: null }
          }, getAxiosConfig(token, proxy));
    
          uploadSpinner.text = 'Step 6: Final receipt confirmation...';
          const finalPayload = { ...receiptData, invoice_path: invoicePath };
          const finalResponse = await axios.post('https://api-v2.polyflow.tech/api/scan2earn/parse_receipt', finalPayload, getAxiosConfig(token, proxy));
    
          if (finalResponse.data && finalResponse.data.success === true) {
            const points = finalResponse.data.msg?.points || 0;
            uploadSpinner.succeed(chalk.greenBright(`Invoice ${j + 1}/${uploadCount} Submitted Successfully. Points: ${points}`));
          } else {
            throw new Error(`Server rejected invoice: ${finalResponse.data.msg?.message || JSON.stringify(finalResponse.data)}`);
          }
    
          if (j < uploadCount - 1) {
            const randomDelay = Math.floor(Math.random() * (20000 - 5000 + 1)) + 5000;
            await countdown(randomDelay);
          }
        } catch (error) {
          uploadSpinner.fail(chalk.redBright(`Failed to Submit Invoice ${j + 1}/${uploadCount}: ${error.message}`));
        }
      }
  } else {
    console.log(chalk.yellow('Skipping upload process as requested.'));
  }

  await completeDailyTask(token, proxy);
  await completeTutorialTask(token, proxy);
  await claimbonus(token, proxy);
  await showTotalPoints(token, proxy);
  console.log(chalk.yellowBright(`\nDone Processing Address: ${shorten(addres)}`));
}

async function run() {
  cfonts.say('Airdropversity', {
    font: 'simple',
    align: 'center',
    colors: ['#34B4F6', '#F6851B'],
    gradient: true,
  });
  console.log(centerText("=== Telegram Channel 🚀: https://t.me/AirdropversityID ==="));
  console.log(centerText(chalk.gray("Original script by NT Exhaust and Vonssy, Modified by Airdropversity\n")));
  console.log(centerText("❖ POLYFLOW AUTO DAILY TASK & UPLOAD FILES ❖ \n"));

  const useProxyAns = await askQuestion('Want To Use Proxy ? (y/n): ');
  const useProxy = useProxyAns.trim().toLowerCase() === 'y';
  let proxies = [];
  if (useProxy) {
    proxies = await readProxies();
    if (proxies.length === 0) { console.log(chalk.yellow('Proxy Not Available, Continuing Without Proxy.')); }
  }
  
  const performUploadAns = await askQuestion('Want to perform uploads? (y/n): ');
  const performUpload = performUploadAns.trim().toLowerCase() === 'y';
  
  let uploadCount = 0;
  if (performUpload) {
    const uploadCountAns = await askQuestion('How many INVOICES to upload for each account per loop?: ');
    uploadCount = parseInt(uploadCountAns, 10);
  }

  const privateKeys = await readPrivateKeys();

  while (true) {
    for (let i = 0; i < privateKeys.length; i++) {
      const privateKey = privateKeys[i];
      const proxy = proxies.length > 0 ? proxies[i % proxies.length] : null;
      console.log();
      console.log(chalk.bold.cyanBright('='.repeat(80)));
      console.log(chalk.bold.whiteBright(`Account: ${i + 1}/${privateKeys.length}`));
      await processAccount(privateKey, proxy, performUpload, uploadCount);
    }
    
    const minHours = 12;
    const maxHours = 24;
    const randomHours = Math.random() * (maxHours - minHours) + minHours;
    const delayInSeconds = Math.floor(randomHours * 3600);
    const delayInH = (delayInSeconds / 3600).toFixed(2);

    console.log(chalk.gray(`\nAll accounts processed. Waiting for ${delayInH} hours before next loop...`));
    await delay(delayInSeconds);
  }
}

run().catch(error => console.error(chalk.red(`Main Error: ${error.message}`)));
