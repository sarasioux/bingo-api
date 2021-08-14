const express = require('express');
const fetch = require('isomorphic-unfetch');
const Web3 = require('web3');
const TruffleContract = require("@truffle/contract");
const p5 = require('node-p5');
const fs = require('fs');

const { createCanvas, loadImage, registerFont } = require('node-canvas');

// Init Graph client data
const { createClient } = require('@urql/core');
const APIURL = "https://api.studio.thegraph.com/query/4841/bingo/v0.0.2";
const graphClient = createClient({
  url: APIURL
});

// Constants
const siteUrl = 'https://bingomorph.netlify.app/';
const apiUrl = 'https://bingomorph-api.herokuapp.com/';
//const provider = 'wss://mainnet.infura.io/ws/v3/72e71a4f135741c9861fda5ad3896e57';
//const provider = 'http://127.0.0.1:7545';
const provider = 'wss://kovan.infura.io/ws/v3/59eea23701b24562a3df2b752064820d';
const ownerAccount = '0xd83Dd8A288270512b8A46F581A8254CD971dCb09';                  // Address of the current queryer

registerFont(process.cwd() + '/assets/SourceCodePro-Bold.ttf', { family: 'Source Code Pro' });

// Start the router
const router = express.Router();
let contract, deployed;

/* GET home page. */
router.get('/', function(req, res) {
    res.json({msg:'GTFO'});
});

router.get('/bingo-json/:id', function(req, res) {
    const id = req.params.id;
    initContract().then(() => {
        cardExists(id).then((cardExists) => {
            if(cardExists) {
                cardIsCurrent(id).then((current) => {
                  let cardJson = {};
                  if(current) {
                    cardJson.image = apiUrl + 'bingo-img/' + id;
                  } else {
                    cardJson.image = apiUrl + 'bingo-art/' + id;
                  }
                  res.json(cardJson);
                });
            } else {
                res.json({exists: cardExists});
            }
        });
    });
    
});

router.get('/bingo-img/:id', function(req, res) {
    const id = req.params.id;
    initContract().then(() => {
      getCard(id).then((cardExists) => {
        if(cardExists) {
          makeCard(id).then((stream) => {
            res.set('Content-Type', 'image/png');
            stream.pipe(res);
          });
        } else {
          var s = fs.createReadStream(process.cwd() + '/assets/generating-card.png');
          s.on('open', function () {
            res.set('Content-Type', 'image/png');
            s.pipe(res);
          });
        }
      });
    });
  
});

router.get('/bingo-art/:id', function(req, res) {
  const id = req.params.id;
  initContract().then(() => {
    getCard(id).then((cardExists) => {
      if(cardExists) {
        makeArt(id).then((stream) => {
          res.set('Content-Type', 'image/png');
          stream.pipe(res);
        });
      } else {
        var s = fs.createReadStream(process.cwd() + '/assets/generating-art.png');
        s.on('open', function () {
          res.set('Content-Type', 'image/png');
          s.pipe(res);
        });
      }
    });
  });
  
});


// Initialize the contract to check on our existing badge status
const initContract = async function() {
    const web3 = new Web3(Web3.givenProvider || provider);
    const response = await fetch(siteUrl + 'contracts/Bingo.json');
    const json = await response.json();
    contract = TruffleContract(json);
    contract.setProvider(web3.currentProvider);
    contract.defaults({
        from: ownerAccount,
        gasPrice: 0
    });
    deployed = await contract.deployed();
};

const cardExists = async function(id) {
  try {
    const cardExists = await deployed.exists.call(id, {from: ownerAccount, value: 0});
    return cardExists;
  }
  catch (error) {
    console.log('Web3 Error', error);
    return false;
  }
};

const cardIsCurrent = async function(id) {
  try {
    const currentGameFloor = await deployed.gameFloor.call({from: ownerAccount, value: 0});
    if(id > currentGameFloor) {
      return true;
    }
    return false;
  }
  catch (error) {
    console.log('Web3 Error', error);
    return false;
  }
};

const getCard = async function(id) {
    try {
        const cardExists = await deployed.cardRandomness.call(id, {from: ownerAccount, value: 0});
        if(cardExists > 0) {
          return cardExists;
        } else {
          return false;
        }
    }
    catch (error) {
        console.log('Web3 Error', error);
        return false;
    }
};

const makeBlank = async function() {
  var s = fs.createReadStream(process.cwd() + '/assets/bingo-card-stonersrock.png');
  s.on('open', function () {
    res.set('Content-Type', type);
    s.pipe(res);
  });
};

const makeCard = async function(id) {
  // Get card randomness values
  let response = await deployed.getCurrent.call();
  const gameId = parseInt(response.game);
  
  let card = await deployed.generateCard.call(id, {from: ownerAccount, value: 0});
  let systemBalls = await getBalls(gameId);
  let balls = {};
  for(let i=0; i<systemBalls.length; i++) {
    balls[systemBalls[i]] = true;
  }
  
  const canvas = createCanvas(700, 700);
  let image = await loadImage(process.cwd() + '/assets/bingo-card-stonersrock.png');
  
  let ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  
  // Fill in boxes
  ctx.font = '65px "Source Code Pro"';
  
  let defaultColor = '#000000';
  let chosenColor = '#7B0E72';
  
  // B
  for(let i=0; i<5; i++) {
    let val = card.B[i];
    let x;
    if(val.length == 1) {
      x = 130;
    } else {
      x = 110;
    }
    if(balls[val]) {
      ctx.fillStyle = chosenColor;
    } else {
      ctx.fillStyle = defaultColor;
    }
    ctx.fillText(val, x, 170+(i*100));
  }
  
  // I
  for(let i=0; i<5; i++) {
    let val = card.I[i];
    if(balls[val]) {
      ctx.fillStyle = chosenColor;
    } else {
      ctx.fillStyle = defaultColor;
    }
    ctx.fillText(val, 210, 170+(i*100));
  }
  
  // N
  for(let i=0; i<5; i++) {
    let val = card.N[i];
    if(val != 99) {
      if(balls[val]) {
        ctx.fillStyle = chosenColor;
      } else {
        ctx.fillStyle = defaultColor;
      }
      ctx.fillText(val, 310, 170+(i*100));
    }
  }
  
  // G
  for(let i=0; i<5; i++) {
    let val = card.G[i];
    if(balls[val]) {
      ctx.fillStyle = chosenColor;
    } else {
      ctx.fillStyle = defaultColor;
    }
    ctx.fillText(val, 410, 170+(i*100));
  }
  
  // O
  for(let i=0; i<5; i++) {
    let val = card.O[i];
    if(balls[val]) {
      ctx.fillStyle = chosenColor;
    } else {
      ctx.fillStyle = defaultColor;
    }
    ctx.fillText(val, 510, 170+(i*100));
  }
  
  const stream = canvas.createPNGStream();
  return stream;
}

const makeArt = async function(id) {
  
  const file = process.cwd() + '/art/' + id;
  console.log('file', file);
  if(fs.existsSync(file + '.png')) {
    console.log('file found');
    return fs.createReadStream(file + '.png');
  }
  
  console.log('file not found');
  
  // Get card randomness values
  let card = await deployed.generateCard.call(id, {from: ownerAccount, value: 0});
  //let systemBalls = await getBalls();
  let systemBalls = await getCardBalls(id);
  let allBalls = {};
  for (let i = 0; i < systemBalls.length; i++) {
    allBalls[systemBalls[i]] = true;
  }
  
  let balls = [];
  for(let k=0; k<card.length; k++) {
    for(let i=0; i<5; i++) {
      if(allBalls[card[k][i]] == true) {
        balls.push(card[k][i]);
      }
    }
  }
  
  if(balls.length < 6) {
    for(i=0; i<6-balls.length; i++) {
      balls.push(i+1);
    }
  }
  
  console.log('allBalls', allBalls);
  console.log('card', card);
  console.log('balls', balls);

  
  let canvas;
  const sketch = function(p) {
    p.setup = () => {
      canvas = p.createCanvas(700, 700);
      setTimeout(() => {
        console.log('saving canvas', file);
        p.saveCanvas(canvas, file, 'png').then(filename => {
          console.log(`saved the canvas as ${filename}`);
        });
      }, 100);
    },
    p.draw = () => {
          p.background(makeColor(card.B[0]), makeColor(card.O[0]), makeColor(card.O[4]));
          p.stroke(0);
      
          p.strokeWeight(0);
          for(let i=0; i<balls.length; i++) {
            let a=i;
            let b=i+1;
            let c=i+2;
            if(b>=balls.length) {
              b=0;
              c=1;
            } else if(c>=balls.length) {
              c=0;
            }
            p.fill(makeColor(balls[b]), makeColor(balls[a]), makeColor(balls[c]));
            p.bezier(
              300, 300,
              balls[a]+10, balls[b],
              balls[c]-100, balls[a],
              300, 300
            );
          }
      
          for(let i=0; i<balls.length; i++) {
            let a=i;
            let b=i+1;
            let c=i+2;
            if(b>=balls.length) {
              b=0;
              c=1;
            } else if(c>=balls.length) {
              c=0;
            }
            p.fill(makeColor(balls[c]), makeColor(balls[b]), makeColor(balls[a]));
            p.bezier(
              300, 300,
              balls[c]*balls[b]-100, balls[b]*balls[a]-100,
              balls[a]*balls[b]-100, balls[c]*balls[a]-100,
              300, 300
            );
          }
      
          for(let i=0; i<balls.length; i++) {
            let a=i;
            let b=i+1;
            let c=i+2;
            if(b>=balls.length) {
              b=0;
              c=1;
            } else if(c>=balls.length) {
              c=0;
            }
            p.fill(makeColor(balls[a]), makeColor(balls[b]), makeColor(balls[c]));
            p.bezier(
              300, 300,
              balls[a]*balls[a], balls[b]*balls[b],
              balls[b]*balls[b], balls[c]*balls[c],
              300, 300
            );
          }
      
          for(let i=0; i<balls.length; i++) {
            let a=i;
            let b=i+1;
            let c=i+2;
            if(b>=balls.length) {
              b=0;
              c=1;
            } else if(c>=balls.length) {
              c=0;
            }
            p.fill(makeColor(balls[c]), makeColor(balls[a]), makeColor(balls[b]));
            p.bezier(
              300, 300,
              balls[a], balls[b]*balls[b],
              balls[b], balls[c]*balls[c],
              300, 300
            );
        
          }
  
    }
  };
  
  await p5.createSketch(sketch);
  return fs.createReadStream(process.cwd() + '/assets/generating-art.png');
};

const makeColor = function(num) {
  return Math.round((num/75)*255);
};

const getCardBalls = async function(cardId) {
  const query = `
            query {
                token(id: ${cardId}) {
                    game {
                      balls {
                        ball
                      }
                    }
                }
            }
        `;
  let response = await graphClient.query(query).toPromise();
  console.log('gameball response', response);
  
  let balls = [];
  if(response.data.token.game.balls.length > 0) {
    for(let i=0; i<response.data.token.game.balls.length; i++) {
      balls.push(parseInt(response.data.token.game.balls[i].ball));
    }
  }
  return balls;
};

const getBalls = async function(gameId) {
  let balls = [];
  const query = `
            query {
                game(id: ${gameId}) {
                    balls {
                      ball
                    }
                }
            }
        `;
  let response = await graphClient.query(query).toPromise();
  if(response.data.game.balls.length > 0) {
    for(let i=0; i<response.data.game.balls.length; i++) {
      balls.push(parseInt(response.data.game.balls[i].ball));
    }
  }
  
  return balls;
};

module.exports = router;
