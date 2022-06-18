const GameTemplate = require('../../lib/templates/gametemplate');
const JSON = require('json-bigint');


//
// Missile Envy is a bit messy
//
var is_this_missile_envy_noneventable = 0;
var is_player_skipping_playing_china_card = 0;
var start_turn_game_state = null;
var start_turn_game_queue = null;

//
// allows cancellation of pick "pickagain"
//
var original_selected_card = null;




//////////////////
// CONSTRUCTOR  //
//////////////////
class Twilight extends GameTemplate {

  constructor(app) {

    super(app);

    this.app             = app;

    this.name  		 = "Twilight";
    this.gamename        = "Twilight Struggle";
    this.slug		 = "twilight";
    this.description     = `Twilight Struggle is a card-driven strategy game for two players, with its theme taken from the Cold War.
      One player plays the United States (US), and the other plays the Soviet Union (USSR).`;
    this.publisher_message = "Twilight Struggle is owned by GMT Games. This module is made available under an open source license provided by GMT Games for usage in open source game engines. Publisher requirements is that at least one player per game has purchased a copy of the game.";
    this.categories      = "Games Arcade Entertainment";

    this.boardWidth  = 5100; //Pieces originally scaled to 5100px wide board
    this.card_height_ratio = 1.39; // height is 1.39x width

    this.moves           = [];
    this.cards    	 = [];
    this.is_testing 	 = 0;

    // newbie mode
    this.confirm_moves = 0;

    this.interface 	 = 1;  //Graphical card display
    
    this.minPlayers 	 = 2;
    this.maxPlayers 	 = 2;
    this.type       	 = "Strategy Boardgame";
    this.categories 	 = "Boardgame Game"
    //this.hud.draggable = 0;
    this.hud.mode = 0;  // long-horizontal
    this.hud.enable_mode_change = 1;
    this.hud.card_width = 120;
    this.playerRoles = ["observer", "ussr", "us"];
    this.region_key = { "asia": "Asia", "seasia": "Southeast Asia", "europe":"Europe", "africa":"Africa", "mideast":"Middle East", "camerica": "Central America", "samerica":"South America"};
    this.grace_window = 25;
  }


  //
  // manually announce arcade banner support
  //
  respondTo(type) {

    if (super.respondTo(type) != null) {
      return super.respondTo(type);
    }

    if (type == "arcade-carousel") {
      let obj = {};
      obj.background = "/twilight/img/arcade/arcade-banner-background.png";
      obj.title = "Twilight Struggle";
      return obj;
    }
   
    return null;
 
  }


  showCardOverlay(cards, title = ""){
    let html = `
      <div class="ts-overlay">
      <h1>${title}</h1>
      <div class="ts-body">
      <div class="cardlist-container">${this.returnCardList(cards)}</div>`;
      if (cards.length == 0) { 
        html = `<div style="text-align:center; margin: auto;">
                There are no cards to display
                </div>`;
      }
      html += "</div></div>";
      this.overlay.show(this.app, this, html);
  }


  showWarOverlay(card, winner, roll, modifications, player = ""){
    let html = `
    <div class="ts-overlay">
    <h1>${this.cardToText(card, true)}</h1>
    <div class="waroverlay-body">
    <div class="cardlist-container">
      <div class="card card-hud">${this.returnCardImage(card)}</div>
    </div>
    <div class="warstats">
      <div class="winner">${winner}</div>
      <div>Roll: ${roll}</div>
      <div>Mod: -${(modifications)?modifications:""}</div>
      <div>Modified Roll: ${roll-modifications}</div>
    `;
    if (player){
      html += `<div>Sponsor: ` + player.toUpperCase() + "</div>";
    }  
    html += `</div></div>`;

    this.overlay.show(this.app, this, html);
  }


  showScoreOverlay(card, point_obj){
   let html = `
    <div class="ts-overlay">
      <h1>${this.cardToText(card, true)}</h1>
      <div class="waroverlay-body">
        <div class="cardlist-container">
          <div class="card card-hud">${this.returnCardImage(card)}</div>
        </div>
        <div class="warstats us">
          <div class="winner">US: ${point_obj.us.vp}</div>
          <div>${(point_obj.us.status)?point_obj.us.status:""}</div>
          <div>Battlegrounds: ${point_obj.us.bg}</div>
          <div>Total Countries: ${point_obj.us.total}</div>
        `;
        if (point_obj.us.neigh?.length > 0){
          html += `<div>Neighbors: `;
          for (let i of point_obj.us.neigh){
            html += this.countries[i].name + " ";
          }
          html += "</div>";
        }
        html += `</div>`;
    html += 
    ` <div class="warstats ussr">
        <div class="winner">USSR:  ${point_obj.ussr.vp}</div>
        <div>${(point_obj.ussr.status)?point_obj.ussr.status:""}</div>
        <div>Battlegrounds: ${point_obj.ussr.bg}</div>
        <div>Total Countries: ${point_obj.ussr.total}</div>
    `; 
    if (point_obj.ussr.neigh?.length > 0){
      html += `<div>Neighbors: `;
      for (let i of point_obj.ussr.neigh){
        html += this.countries[i].name + " ";
      }
      html += "</div>";
    }
    if (point_obj.shuttle){
      html += "<div>USSR loses one battleground from " + this.cardToText("shuttle") + "</div>";
    }
    html += `</div>`;

    html += `</div>`;
    this.overlay.show(this.app, this, html); 
  }

  handleExportMenu() {

    let twilight_self = this;
    let html =
    `
      <div class="game-overlay-menu" id="game-overlay-menu">
        <div>Export Options:</div>
       <ul>
          <li class="menu-item" id="private">Private <div style="font-size:0.8em;clear:both">Create a backup file that saves the game along with the (encrypted) hands of each player. Only the current players will be able to restore the game.</div></li>
        </ul>
      </div>
    `;

    twilight_self.overlay.show(twilight_self.app, twilight_self, html);

    $('.menu-item').on('click', function() {

      let player_action = $(this).attr("id");

      switch (player_action) {
        case "private":
          break;
        default:
          break;
      }

      twilight_self.overlay.show(twilight_self.app, twilight_self, "All players are backing up their game...");
    });

  }

  

  handleStatsMenu() {
    let twilight_self = this;

    let us_bg = 0;
    let ussr_bg = 0;

    for (var i in twilight_self.countries) {
      let countryname = i;

      if (twilight_self.countries[countryname].bg == 1) {
        if (this.isControlled("us", i) == 1) {
          us_bg++;
        }
        if (this.isControlled("ussr", i) == 1) {
          ussr_bg++;
        }
      }
    }

    let html = `
      <div class="game-overlay-menu statistics-overlay">
      <table class="headline-statistics-table">
        <caption>Overall Statistics</caption>
        <thead>
        <tr>
          <th></th>
          <th>US</th>
          <th>USSR</th>
        </tr>
        </thead>
        <tbody>
        <tr>
          <th>OPS Played</th>
          <td>${this.game.state.stats.us_ops}</td>
          <td>${this.game.state.stats.ussr_ops}</td>
        </tr>
        <tr>
          <th>OPS Spaced</th>
          <td>${this.game.state.stats.us_ops_spaced}</td>
          <td>${this.game.state.stats.ussr_ops_spaced}</td>
        </tr>
        <tr>
          <th>Scoring Cards</th>
          <td>${this.game.state.stats.us_scorings}</td>
          <td>${this.game.state.stats.ussr_scorings}</td>
        </tr>
        <tr>
          <th>Battlegrounds Controlled</th>
          <td>${us_bg}</td>
          <td>${ussr_bg}</td>
        </tr>
        <tr>
          <th>Coups</th>
          <td>`;
    if (this.game.state.stats.us_coups.length > 0) {
      html += JSON.stringify(this.game.state.stats.us_coups);
    }else {
      html += "0";
    }
    html += `</td><td>`;
    if (this.game.state.stats.ussr_coups.length > 0) {
      html += JSON.stringify(this.game.state.stats.ussr_coups);
    }else {
      html += "0";
    }
    html += `</td>
        </tr>
        </table>
      
      <table class="statistics-round-table">
      <caption>Round-by-Round Statistics</caption>
        <thead>
        <tr><th></th>`;

    for (let z = 1; z < 11; z++) {
      html += `<th>R${z}</th>`;
    }

    html += `</tr></thead>`;

    html += '<tbody><th>OPS</th>';
    for (let z = 0; z < 10; z++) {
      if (z > this.game.state.stats.round.length) {
        html += `<td> - </td>`;
      } else {
        if (z == this.game.state.stats.round.length) {
          html += `<td>${this.game.state.stats.us_ops - this.game.state.stats.ussr_ops}</td>`;
        } else {
          html += `<td>${
            this.game.state.stats.round[z].us_ops - this.game.state.stats.round[z].ussr_ops
          }</td>`;
        }
      }
    }
    html += "</tr>";

    html += "<tr>";
    html += '<th>VP</th>';

    for (let z = 0; z < 10; z++) {
      if (z > this.game.state.stats.round.length) {
        html += `<td> - </td>`;
      } else {
        if (z == this.game.state.stats.round.length) {
          html += `<td>${this.game.state.vp}</th>`;
        } else {
          html += `<td>${this.game.state.stats.round[z].vp}</th>`;
        }
      }
    }

    html += "</tr>";
    html += "<tr>";
    html += '<th>US Scoring</th>';

    for (let z = 0; z < 10; z++) {
      if (z > this.game.state.stats.round.length) {
        html += `<td> - </td>`;
      } else {
        if (z == this.game.state.stats.round.length) {
          html += `<td>${this.game.state.stats.us_scorings}</th>`;
        } else {
          html += `<td>${this.game.state.stats.round[z].us_scorings}</th>`;
        }
      }
    }
    html += "</tr>";
    html += "<tr>";
    html += '<th>USSR Scoring</th>';
    for (let z = 0; z < 10; z++) {
      if (z > this.game.state.stats.round.length) {
        html += `<td> - </td>`;
      } else {
        if (z == this.game.state.stats.round.length) {
          html += `<td>${this.game.state.stats.ussr_scorings}</th>`;
        } else {
          html += `<td>${this.game.state.stats.round[z].ussr_scorings}</th>`;
        }
      }
    }

    html += "</tr>";

    html += `
            </table>
        `;
    html += `
          </div>
        `;

    twilight_self.overlay.show(twilight_self.app, twilight_self, html);
  }


  /* Mostly deprecated, but potential useful logic for adding game clock to menu */
  handleDisplayMenu() {

    let twilight_self = this;
    let use_clock_html = '';
    if (twilight_self.useClock == 1) { use_clock_html = '<li class="menu-item" id="move_clock">Move Clock</li>'; }

    let user_message = `
      <div class="game-overlay-menu" id="game-overlay-menu">
        <div>DISPLAY MODE:</div>
        <ul>${use_clock_html}</ul>
      </div>`;
    //<li class="menu-item" id="text">Text Cards</li>
    //<li class="menu-item" id="graphics">Graphical Cards</li>

    twilight_self.overlay.show(twilight_self.app, twilight_self, user_message);

    $('.menu-item').on('click', function() {
      let action2 = $(this).attr("id");

      if (action2 === "move_clock") {
      	twilight_self.clock.moveClock();
      	return;
      }


      if (action2 === "text") {
        twilight_self.displayModal("Card Menu options changed to text-mode. Please reload.");
        twilight_self.interface = 0;
        twilight_self.saveGamePreference("interface", 0);
	      setTimeout(function() { window.location.reload(); }, 1000);
      }

      if (action2 === "graphics") {
        twilight_self.displayModal("Card Menu options changed to graphical mode. Please reload.");
        twilight_self.interface = 1;
        twilight_self.saveGamePreference("interface", 1);
      	setTimeout(function() { window.location.reload();	}, 1000);
      }

    });
  }

 
  initializeHTML(app) {

    if (this.browser_active == 0) { return; }

    super.initializeHTML(app);

    //
    // check language preference
    //
    if (app.browser.returnPreferredLanguage() === "zh") {
      if (!app?.options?.gameprefs?.lang) {
        this.lang = "zh";
        this.saveGamePreference("lang", "zh");
      }
    }

    // required here so menu will be proper
    try {
      if (this.app.options.gameprefs.twilight_expert_mode == 1) {
        this.confirm_moves = 0;
      } else {
        this.confirm_moves = 1; 
      }
    } catch (err) {}

    this.menu.addMenuOption({
      text : "Game",
      id : "game-game",
      class : "game-game",
      callback : function(app, game_mod) {
      	game_mod.menu.showSubMenu("game-game");
      }
    });
   
    this.menu.addSubMenuOption("game-game", {
      text : "Play Mode",
      id : "game-confirm",
      class : "game-confirm",
      callback : function(app, game_mod) {
         game_mod.menu.showSubSubMenu("game-confirm"); 
      }
    });


    this.menu.addSubMenuOption("game-confirm",{
      text: `Newbie ${(this.confirm_moves==1)?"✔":""}`,
      id:"game-confirm-newbie",
      class:"game-confirm-newbie",
      callback: function(app,game_mod){
        if (game_mod.confirm_moves == 0){
          game_mod.displayModal("Game Settings", "Will confirm moves before committing");
          game_mod.confirm_moves = 1;
          game_mod.saveGamePreference('twilight_expert_mode', 0);
          setTimeout(function() { window.location.reload(); }, 1000);
        }else{
          game_mod.menu.hideSubMenus();
        }
      }
    });
   
    this.menu.addSubMenuOption("game-confirm",{
      text: `Expert ${(this.confirm_moves==1)?"":"✔"}`,
      id:"game-confirm-expert",
      class:"game-confirm-expert",
      callback: function(app,game_mod){
        if (game_mod.confirm_moves ==1){
          game_mod.displayModal("Game Settings", "No need to confirm moves");
          game_mod.confirm_moves = 0;
          game_mod.saveGamePreference('twilight_expert_mode', 1);
          setTimeout(function() { window.location.reload(); }, 1000);
        }else{
          game_mod.menu.hideSubMenus();
        }
      }
    });

    this.menu.addSubMenuOption("game-game", {
      text : "How to Play",
      id : "game-rules",
      class : "game-rules",
      callback : function(app, game_mod) {
         game_mod.menu.hideSubMenus();
         game_mod.overlay.show(game_mod.app, game_mod, game_mod.returnGameRulesHTML()); 
      }
    });

    if (app.modules.returnModule("Post")) {
    this.menu.addSubMenuOption("game-game", {
      text : "Screenshot",
      id : "game-post",
      class : "game-post",
      callback : async function(app, game_mod) {
        await app.browser.captureScreenshot(function(image) {
          game_mod.app.modules.returnModule("Post").postImage(image, game_mod.returnSlug());
        });
      },
    });
    }

    this.menu.addSubMenuOption("game-game", {
      text : "Stats",
      id : "game-stats",
      class : "game-stats",
      callback : async function(app, game_mod) {
      	game_mod.menu.hideSubMenus();
        game_mod.handleStatsMenu();
      }
    });

/****
    this.menu.addSubMenuOption("game-game", {
      text: "Invite Observer",
      id: "game-observer",
      class: "game-observer",
      callback: function(app, game_mod){
        game_mod.game.saveGameState = 1;
        let msgobj = {
          game_id : game_mod.game.id ,
          player : app.wallet.returnPublicKey() ,
          module : game_mod.game.module
        };
        let msg = app.crypto.stringToBase64(JSON.stringify(msgobj));
        let observe_link = window.location.href;
        let tmpar = observe_link.split("/");
        let oblink = tmpar[0] + "//" + tmpar[2];
        let html  = `<div class="status-message" id="status-message">Observer Mode will be enabled on your next move (reload to cancel). Make your move and then share this link:
        <div style="padding:15px;font-size:0.9em;overflow-wrap:anywhere">${oblink}/arcade/?i=watch&msg=${msg}</div></div>`;
        game_mod.overlay.show(app, game_mod, html);
      }
    });
****/

    this.menu.addSubMenuOption("game-game", {
      text : "Exit",
      id : "game-exit",
      class : "game-exit",
      callback : function(app, game_mod) {
        window.location.href = "/arcade";
      }
    });


    this.menu.addMenuOption({
      text : "Cards",
      id : "game-cards",
      class : "game-cards",
      callback : function(app, game_mod) {
        game_mod.menu.showSubMenu("game-cards");
	     }
    });
    this.menu.addSubMenuOption("game-cards",{
      text: "My Hand",
      id: "game-cards-hand",
      class: "game-cards-hand",
      callback: function(app,game_mod){
        game_mod.menu.hideSubMenus();
        game_mod.showCardOverlay(game_mod.game.deck[0].hand, "My Hand");
      }
    });
    this.menu.addSubMenuOption("game-cards",{
      text: "Discards",
      id: "game-cards-discards",
      class: "game-cards-discards",
      callback: function(app,game_mod){
        game_mod.menu.hideSubMenus();
        game_mod.showCardOverlay(Object.keys(game_mod.game.deck[0].discards), "Discards");
      }
    });
    this.menu.addSubMenuOption("game-cards",{
      text: "Removed",
      id: "game-cards-removed",
      class: "game-cards-removed",
      callback: function(app,game_mod){
        game_mod.menu.hideSubMenus();
        game_mod.showCardOverlay(Object.keys(game_mod.game.deck[0].removed), "Removed Cards");
      }
    });
    this.menu.addSubMenuOption("game-cards",{
      text: "Unplayed",
      id: "game-cards-unplayed",
      class: "game-cards-unplayed",
      callback: function(app,game_mod){
        game_mod.menu.hideSubMenus();
        game_mod.showCardOverlay(Object.keys(game_mod.returnUnplayedCards()), "Unplayed Cards");
      }
    });


    this.menu.addMenuOption({
      text : "Display",
      id : "game-display",
      class : "game-display",
      callback : function(app, game_mod) {
	       game_mod.menu.showSubMenu("game-display");
      }
    });

    this.menu.addSubMenuOption("game-display",{
      text: "Language",
      id: "game-language",
      class: "game-language",
      callback: function(app, game_mod){
        game_mod.menu.showSubSubMenu("game-language");
      }
    });

    this.menu.addSubMenuOption("game-language", {
      text: `English ${(this.lang=="en")?"✔":""}`,
      id: "game-language-en",
      callback: function(app, game_mod){
        game_mod.displayModal("Language Settings", "Card settings changed to English");
        game_mod.lang = "en";
        game_mod.saveGamePreference("lang", "en");
        setTimeout(function() { window.location.reload(); }, 1000);
      }
    });
  this.menu.addSubMenuOption("game-language", {
      text: `简体中文 ${(this.lang=="zh")?"✔":""}`,
      id: "game-language-zh",
      callback: function(app, game_mod){
        game_mod.displayModal("语言设定", "卡牌语言改成简体中文");
        game_mod.lang = "zh";
        game_mod.saveGamePreference("lang", "zh");
        setTimeout(function() { window.location.reload(); }, 1000);
      }
    });

    this.menu.addSubMenuOption("game-display", {
      text : "Log",
      id : "game-log",
      class : "game-log",
      callback : function(app, game_mod) {
        game_mod.menu.hideSubMenus();
        game_mod.log.toggleLog();
      }
    });
    this.menu.addSubMenuOption("game-display", {
      text : "HUD",
      id : "game-display-hud",
      class : "game-display-hud",
      callback : function(app, game_mod) {
        game_mod.menu.hideSubMenus();
        game_mod.hud.toggleHud();
      }
    });
    this.menu.addChatMenu(app, this);

    this.menu.addMenuIcon({
      text : '<i class="fa fa-window-maximize" aria-hidden="true"></i>',
      id : "game-menu-fullscreen",
      callback : function(app, game_mod) {
	      game_mod.menu.hideSubMenus();
        app.browser.requestFullscreen();
      }
    });
    this.menu.render(app, this);
    this.menu.attachEvents(app, this);

    this.log.render(app, this);
    this.log.attachEvents(app, this);

    this.cardbox.render(app, this);
    this.cardbox.attachEvents(app, this);

    //
    // add card events -- text shown and callback run if there
    //
    this.cardbox.addCardType("showcard", "", null);
    this.cardbox.addCardType("card", "select", this.cardbox_callback);
    
    try {

      if (app.browser.isMobileBrowser(navigator.userAgent)) {
        this.hud.card_width = 110;
        this.cardbox.skip_card_prompt = 0;
        this.hammer.render(this.app, this);
        this.hammer.attachEvents(this.app, this, '.gameboard');

      } else {
        this.hud.card_width = 120; // hardcode max card size
        this.sizer.render(this.app, this);
        this.sizer.attachEvents(this.app, this, '.gameboard');
      }

    } catch (err) {}

    this.hud.render(app, this);
    this.hud.attachEvents(app, this);

    /* Attach classes to hud to visualize player roles */
    //this.game.player == 1 --> ussr, == 2 --> usa
    let hh = document.querySelector(".hud-header");
    if (hh){
      switch(this.game.player){
        case 1: hh.classList.add("soviet"); break;
        case 2: hh.classList.add("american"); break;
        default:
      }  
    }

  }


  ////////////////
  // initialize //
  ////////////////
initializeGame(game_id) {

  //
  // check user preferences to update interface, if text
  //
  
  if (this.app?.options?.gameprefs) {
    this.interface = this.app.options.gameprefs.interface || this.interface;  
    
    /*if (this.app.options.gameprefs.twilight_expert_mode == 1) {
      this.confirm_moves = 0;
    } else {
      this.confirm_moves = 1;
    }*/
  }
    
  //
  // VP needed
  //
  this.game.vp_needed = 20;

  //
  // initialize
  //
  if (!this.game.state) {

    this.game.countries = this.returnCountries();
    this.game.state = this.returnState();

    console.log("\n\n\n\n");
    console.log("---------------------------");
    console.log("---------------------------");
    console.log("------ INITIALIZE GAME ----");
    console.log("---------------------------");
    console.log("---------------------------");
    console.log("---------------------------");
    console.log("DECK: " + this.game.options.deck);
    console.log("\n\n\n\n");

    this.updateStatus("<div class='status-message' id='status-message'>Generating the Game</div>");

    this.game.queue.push("round");
    if (this.game.options.usbonus != undefined) {
      if (this.game.options.usbonus > 0) {
        this.game.queue.push("placement_bonus\t2\t"+this.game.options.usbonus);
      }
    }
    this.game.queue.push("placement\t2");
    this.game.queue.push("placement\t1");
    this.game.queue.push("READY");
    this.game.queue.push("DEAL\t1\t2\t8");
    this.game.queue.push("DEAL\t1\t1\t8");
    this.game.queue.push("DECKENCRYPT\t1\t2");
    this.game.queue.push("DECKENCRYPT\t1\t1");
    this.game.queue.push("DECKXOR\t1\t2");
    this.game.queue.push("DECKXOR\t1\t1");

    //
    // TESTING
    //
    if (this.is_testing == 1) {

      this.game.options = {};
      this.game.options.culturaldiplomacy = 1;
      this.game.options.gouzenkoaffair = 1;
      this.game.options.berlinagreement = 1;
      this.game.options.handshake = 1;
      this.game.options.rustinredsquare = 1;
      this.game.options.poliovaccine = 1;
      this.game.options.communistrevolution = 1;

      this.game.options.deck = "endofhistory";
      let a = this.returnEarlyWarCards();
      let b = this.returnMidWarCards();
      let c = this.returnLateWarCards();
      let d = Object.assign({}, a, b);
      let e = Object.assign({}, d, c);

      this.game.options.deck = "coldwarcrazies";
      let f = this.returnEarlyWarCards();
      let g = this.returnMidWarCards();
      let h = this.returnLateWarCards();
      let i = Object.assign({}, f, e);
      let j = Object.assign({}, g, i);
      let k = Object.assign({}, h, j);

      this.game.options.deck = "absurdum";
      let l = this.returnEarlyWarCards();
      let m = this.returnMidWarCards();
      let n = this.returnLateWarCards();
      let o = Object.assign({}, l, k);
      let p = Object.assign({}, m, o);
      let q = Object.assign({}, n, p);
      
      this.game.queue.push("DECK\t1\t"+JSON.stringify(k));
    } else {
      this.game.queue.push("DECK\t1\t"+JSON.stringify(this.returnEarlyWarCards()));
    }
    this.game.queue.push("init");

  }

  this.countries = this.game.countries; //strange choice


  if (this.game.state.headline == 1 && this.game.state.headline_card == ""){
    this.playerPickHeadlineCard(); //In case reloading during the headline selection...
  }

  //
  // adjust screen ratio
  //
try {
  $('.country').css('width', this.scale(202)+"px");
  $('.us').css('width', this.scale(100)+"px");
  $('.ussr').css('width', this.scale(100)+"px");
  $('.us').css('height', this.scale(100)+"px");
  $('.ussr').css('height', this.scale(100)+"px");

  //
  $('.formosan_resolution').css('width', this.scale(202)+"px");
  $('.formosan_resolution').css('height', this.scale(132)+"px");
  $('.formosan_resolution').css('top', this.scale(this.countries['taiwan'].top-32)+"px");
  $('.formosan_resolution').css('left', this.scale(this.countries['taiwan'].left)+"px");

  //
  // update defcon and milops and stuff
  //
  this.displayBoard();
  
} catch (err) {} // we must be in invite page

  //
  // initialize interface
  //
  for (var i in this.countries) {

    let divname      = '#'+i;
    let divname_us   = divname + " > .us > img";
    let divname_ussr = divname + " > .ussr > img";

    let us_i   = 0;
    let ussr_i = 0;

    try {
      $(divname).css('top', this.scale(this.countries[i].top)+"px");
      $(divname).css('left', this.scale(this.countries[i].left)+"px");
      $(divname_us).css('height', this.scale(100)+"px");
      $(divname_ussr).css('height', this.scale(100)+"px");

      //Want to display without triggering shake event

      if (this.countries[i].us > 0 || this.countries[i].ussr > 0) { 
        this.showInfluence(i); 
      }
    
    } catch (err) {} // invite page

  }


  try {

    let twilight_self = this;
    $('.scoring_card').off();
    $('.scoring_card').mouseover(function() {

      let region = this.id;
      let scoring = twilight_self.calculateScoring(region, 1);
      let total_vp = scoring.us.vp - scoring.ussr.vp;
      let vp_color = "white";

      if (total_vp > 0) { vp_color = "blue" }
      if (total_vp < 0) { vp_color = "red" }
      if (total_vp > (twilight_self.game.vp_needed) || total_vp < (twilight_self.game.vp_needed*-1)) { total_vp = "WIN" }

      $(`.display_card#${region}`).show();
      $(`.display_vp#${region}`).html(
        `VP: <div style="color:${vp_color}">&nbsp${total_vp}</div>`
      );
    }).mouseout(function() {
      let region = this.id;
      $(`.display_card#${region}`).hide();
    })

  } catch (err) {}

}





  //
  // Core Game Logic
  //
  handleGameLoop() {

    let twilight_self = this;
    let player = (this.game.player === 1) ? "ussr" : "us"; 

    //
    // support observer mode
    //
    if (this.game.player === 0) { player = "observer"; }

    //
    // avoid China bug on reshuffle - sept 27
    //
    try {
    if (this.game.deck[0]) {
      if (this.game.deck[0].cards) {
        this.game.deck[0].cards["china"] = this.returnChinaCard();
      }
    }
    } catch (err) {}



    if (this.game.over == 1) {
      let winner = "ussr";
      if (this.game.winner == 2) { winner = "us"; }
      let gid = $('#sage_game_id').attr("class");
      if (gid === this.game.id) {
        this.updateStatus("<div class='status-message' id='status-message'><span>Game Over:</span> "+winner.toUpperCase() + "</span> <span>wins</span></div>");
      }

      return 0;
    }



    ///////////
    // QUEUE //
    ///////////
    if (this.game.queue.length > 0) {

      let qe = this.game.queue.length-1;
      let mv = this.game.queue[qe].split("\t");
      let shd_continue = 1;

      //
      // cambridge region
      // chernobyl region
      // grainsales sender card
      // missileenvy sender card
      // latinamericandebtcrisis (if USSR can double)
      // che ussr country_of_target1
      //
      // start round
      // flush [discards] // empty discards pile if exists
      // placement (initial placement)
      // ops [us/ussr] card num
      // round
      // revert -- return to start of turn
      // move [us/ussr]
      // turn [us/ussr]
      // event [us/ussr] card
      // remove [us/ussr] [us/ussr] countryname influence     // player moving, then player whose ops to remove
      // place [us/ussr] [us/ussr] countryname influence      // player moving, then player whose ops to remove
      // resolve card
      // space [us/ussr] card
      // defcon [lower/raise]
      // coup [us/ussr] countryname influence
      // realign [us/ussr] countryname
      // card [us/ussr] card  --> hand card to play
      // vp [us/ussr] points [delay_settlement_until_end_of_turn=1]
      // discard [us/ussr] card --> discard from hand
      // discard [ussr/us] card
      // deal [1/2]  --- player decides how many cards they need, adds DEAL and clears when ready
      // init -- assign roles
      // observer -- reveal cards to player0s (insecure)

      if (mv[0] == "init") {

        this.game.queue.splice(qe, 1);
  	    
  	    // observer skips
  	    if (this.game.player === 0 || !this.game.players.includes(this.app.wallet.returnPublicKey())) { 
            return 1;
  	    } 

        //Game engine automatically randomizes player order, so we are good to go
        if (!this.game.options.player1 || this.game.options.player1 == "random"){
          return 1;
        }
        
        //Reordeer the players so that originator can be the correct role
        if (this.game.options.player1 === "ussr"){
          if (this.game.players[0] !== this.game.originator){
            let p = this.game.players.shift();
            this.game.players.push(p);
          }
        }else{
          if (this.game.players[1] !== this.game.originator){
            let p = this.game.players.shift();
            this.game.players.push(p);
          }
        }
        //Fix game.player so that it corresponds to the indices of game.players[]
        for (let i = 0; i < this.game.players.length; i++){
          if (this.game.players[i] === this.app.wallet.returnPublicKey()){
            this.game.player = i+1;
          }
        }
        
      }

  	if (mv[0] === "update_observers") {
  	  let p = parseInt(mv[1]);
  	  if (this.game.player == p) {
  	    this.addMove("observer_cards_update\t"+this.game.player+"\t"+JSON.stringify(this.game.deck[0].hand));
  	    this.endTurn();
  	  }

      this.game.queue.splice(qe, 1); //This may be better placed before adding moves to the queue, no?
  	  return 0;
  	}

    if (mv[0] === "observer_cards_update") {

  	  let cards = JSON.stringify(mv[2]);

  	  //if (mv[1] == this.game.observer_mode_player) { //game.observer_mode_player is undefined
  	    if (this.game.player == 0) {
  	      this.game.deck[0].hand = [];
  	      for (let i = 0; i < cards.length; i++) {
  	        this.game.deck[0].hand.push(cards[i]);
  	      }
  	    }
  	  //}

      this.game.queue.splice(qe, 1);
	    return 1;

    }
    
    if (mv[0] === "revert") {
      this.revertTurn();
      this.game.queue.splice(qe, 1);
    }

    if (mv[0] === "turn") {
      this.game.state.turn_in_round++;
      this.game.state.events.china_card_eligible = 0;
      this.game.queue.splice(qe, 1);
      this.updateActionRound();
    }

    if (mv[0] === "discard") {
      if (mv[2] === "china") {
        // china card switches hands
        if (mv[1] == "ussr") {
          this.updateLog("China Card passes to US face down");
          this.game.state.events.china_card = 2;
        }
        if (mv[1] == "us") {
          this.updateLog("China Card passes to USSR face down");
          this.game.state.events.china_card = 1;
        }

        this.game.state.events.china_card_facedown = 1;
        this.displayChinaCard();

      } else {
        // remove from hand if present
        this.removeCardFromHand(mv[2]);

        //
        // missile envy is an exception, non-player triggers
        if (mv[2] == "missileenvy" && this.game.state.events.missile_envy != this.game.player) {
          this.game.state.events.missile_envy = 0;
          this.game.state.events.missileenvy = 0;
        }

        for (var i in this.game.deck[0].cards) {
          if (mv[2] == i) {
            if (this.game.deck[0].cards[mv[2]] != undefined) {
              // move to discard pile
              this.updateLog(`${mv[1].toUpperCase()} discards ${this.cardToText(mv[2])}`);

              // discard pile is parallel to normal
              this.game.deck[0].discards[i] = this.game.deck[0].cards[i];
            }
          }
        }
      }
      this.game.queue.splice(qe, 1);
    }

	//
	// remove from discards (will still be in cards)
	//
    if (mv[0] === "undiscard") {

      let cardkey = mv[1];

      for (var i in this.game.deck[0].discards) {
        if (cardkey == i) {
          if (this.game.deck[0].discards[cardkey] != undefined) {
            // remove from discards
            this.updateLog(`${this.cardToText(cardkey)} removed from discard pile`);
        		delete this.game.deck[0].discards[cardkey];
          }
        }
      }

      this.game.queue.splice(qe, 1);
    }

    //
    // wargames
    //
    if (mv[0] == "wargames") {

      let activate = parseInt(mv[2]);

      if (activate == 0) {
        //
        // card is discarded, nothing happens
        //
      } else {
        if (mv[1] == "us") {
          this.game.state.vp -= this.game.state.wargames_concession;
        } else {
          this.game.state.vp += this.game.state.wargames_concession;
        }
        this.updateVictoryPoints();
        if (this.game.state.vp > 0) {
          this.endGame(this.game.players[1],"Wargames");
        }
        if (this.game.state.vp < 0) {
          this.endGame(this.game.players[0],"Wargames");
        }
        if (this.game.state.vp == 0) {
          this.tieGame();
        }

      }

      return 0;
    }



    //
    // card [player] [card]
    //
    if (mv[0] === "card") {
      this.game.queue.splice(qe, 1);

      if (player == mv[1]) {
  	    this.playerTurn(mv[2]);
  	  } 

  	  shd_continue = 0;
    }



    //
    // grainsales
    //
    if (mv[0] === "grainsales") {

      //
      // this is the ussr telling the us what card they can choose
      //
      if (mv[1] == "ussr") {

        // remove the command triggering this
        this.game.queue.splice(qe, 1);

        if (this.game.player == 2) {

          let user_message  = `${this.cardToText(mv[0])} pulls ${this.cardToText(mv[2])} from USSR. Do you want to play this card?`;
          let html = "<ul>";
          if (mv[2] == "unintervention" && this.game.state.headline == 1) {
          } else {
            html += '<li class="card noncard" id="play">play card</li>';
          }
          html += '<li class="card noncard" id="nope">return card</li>';
          html += '</ul>';
          this.updateStatusWithOptions(user_message, html, false);

          twilight_self.attachCardboxEvents(function(action2) {
            if (action2 == "play") {
              // trigger play of selected card
              twilight_self.addMove("resolve\tgrainsales");
              twilight_self.playerTurn(mv[2]);
            }
            if (action2 == "nope") {
              twilight_self.addMove("resolve\tgrainsales");
              twilight_self.addMove("ops\tus\tgrainsales\t2");
              twilight_self.addMove("grainsales\tus\t"+mv[2]);
              twilight_self.endTurn();
            }
          });

        }
        shd_continue = 0;
      }

      //
      // this is the us telling the ussr they are returning a card
      //
      if (mv[1] == "us") {

        if (this.game.player == 1) {
          this.game.deck[0].hand.push(mv[2]);
        } else {
          //
          // us increases ussr cards in hand to avoid deal errors
          //
          this.game.state.opponent_cards_in_hand++;
  	    }

        this.game.queue.splice(qe, 1);
        shd_continue = 1;
      }
    }

    // Stage
    if (mv[0] == "stage") {
      this.game.queue.splice(qe, 1);
      shd_continue = 1;
    }

    //
    // Che
    if (mv[0] == "checoup") {

      let target1 = mv[2];
      let original_us = this.countries[mv[2]].us;
      let couppower = parseInt(mv[3]);

      //
      // this is the first coup, which runs on both
      // computers, so they can collectively see the
      // results.
      //
      twilight_self.playCoup("ussr", mv[2], couppower, function() {
        twilight_self.game.queue.splice(qe, 1); //Remove checoup from queue

        //Test if first coup was successful
        if (twilight_self.countries[mv[2]].us < original_us) {
          //Repeat code from che.js

          let valid_targets = 0;
          for (let c in twilight_self.countries) {
        
            if ( twilight_self.countries[c].bg == 0 && (twilight_self.countries[c].region == "africa" || twilight_self.countries[c].region == "camerica" || twilight_self.countries[c].region == "samerica") && twilight_self.countries[c].us > 0 ) {
              //Must be a new target for second attempt
              if (c !== target1){
                valid_targets++;
                $("#"+c).addClass("easterneurope");  
              }
            }
          }

          if (valid_targets == 0) {
            twilight_self.updateLog("No more valid targets for Che");
            //just need one player to send a signal to restart the queue processing
            if (twilight_self.game.player == 2){
              twilight_self.endTurn();
            }
         
          } else {

            if (twilight_self.game.player == 2) {
              twilight_self.updateStatus(`<div class='status-message' id='status-message'>Waiting for USSR to play second ${twilight_self.cardToText("che")} coup</div>`);
              twilight_self.attachCardboxEvents();
              return 0;
            }   

            if (twilight_self.game.player == 1) {


              let user_message = "Pick second target for coup:";
              let html =  '<ul><li class="card" id="skipche">or skip coup</li></ul>';
                  
              twilight_self.updateStatusWithOptions(user_message, html, false);

              twilight_self.attachCardboxEvents(function(action2) {
                if (action2 == "skipche") {
                  twilight_self.endTurn();
                  twilight_self.updateStatus("<div class='status-message' id='status-message'>Skipping Che coups...</div>");
                }
              });


              $(".easterneurope").on('click', function() {
                twilight_self.playerFinishedPlacingInfluence("ussr");
                let c = $(this).attr('id');
                twilight_self.addMove("coup\tussr\t"+c+"\t"+couppower);
                twilight_self.addMove("NOTIFY\tChe launches coup in "+twilight_self.countries[c].name);
                twilight_self.endTurn();
              });
            }
          }

        } else {
          //just need one player to send a signal to restart the queue processing
          if (twilight_self.game.player == 2){
            twilight_self.endTurn();
          }
        }
      });

      shd_continue = 0;
    }

    //
    // missileenvy \t sender \t card
    //
    if (mv[0] === "missileenvy") {

      let sender = mv[1];
      let card = mv[2];
      let receiver = "us";
      let discarder = "ussr";
      if (sender == 2) { receiver = "ussr"; discarder = "us"; }

      this.game.state.events.missile_envy = sender;

      let opponent_card = 0;
      if (this.game.deck[0].cards[card].player == "us" && sender == 2) { opponent_card = 1; }
      if (this.game.deck[0].cards[card].player == "ussr" && sender == 1) { opponent_card = 1; }

      // remove missileenvy from queue
      this.game.queue.splice(qe, 1);

      //
      // play for ops
      //
      if (opponent_card == 1) {
        this.game.queue.push("discard\t"+discarder+"\t"+card);
        this.game.queue.push("ops\t"+receiver+"\t"+card+"\t"+this.game.deck[0].cards[card].ops);
        this.game.queue.push("NOTIFY\t"+discarder.toUpperCase() + " offers " + this.game.deck[0].cards[card].name + " for OPS");
      }

      //
      // or play for event
      //
      if (opponent_card == 0) {
        this.game.queue.push("discard\t"+discarder+"\t"+card);
        this.game.queue.push("event\t"+receiver+"\t"+card);
        this.game.queue.push("NOTIFY\t"+discarder.toUpperCase() + " offers " + this.game.deck[0].cards[card].name + " for EVENT");
      }

      //
      // remove card from hand
      //
      if (this.game.player == sender) {
        this.removeCardFromHand(card);
      }

      shd_continue = 1;

    }

    if (mv[0] === "quagmire") {
      let discard = mv[2];
      let sticker = (mv[1]=="ussr") ? "beartrap": "quagmire";
      
      let roll = this.rollDice(6);

      this.updateLog(`${this.cardToText(sticker)}: ${mv[1].toUpperCase()} discards ${this.cardToText(discard)} and rolls a ${roll}`);

      if (roll < 5) {
        if (mv[1] == "ussr") {
          this.game.state.events.beartrap = 0;
        }
        if (mv[1] == "us") {
          this.game.state.events.quagmire = 0;
        }
        this.updateLog(`${this.cardToText(sticker)} ends`);
        this.displayModal(`${mv[1].toUpperCase()} extricates itself from ${this.cardToText(sticker)}`);
      } else {
        this.updateLog(`${this.cardToText(sticker)} continues...`);
        this.displayModal(`${mv[1].toUpperCase()} remains stuck in the ${this.cardToText(sticker)}`);
      }

      this.game.queue.splice(qe, 1);
      shd_continue = 1;

    }
    

    if (mv[0] == "tehran") {

      let sender  = mv[1];
      let keysnum = mv[2];
      this.game.queue.splice(qe, 1);

      if (sender == "ussr") {

        //
        // ussr has sent keys to decrypt
        //
        if (this.game.player == 1) {

          for (let i = 0; i < keysnum; i++) { this.game.queue.splice(this.game.queue.length-1, 1); }
          shd_continue = 0;

        } else {

          //
          // us decrypts and decides what to toss
          //
          var cardoptions = [];
          var pos_to_discard = [];

          for (let i = 0; i < keysnum; i++) {
            cardoptions[i] = this.game.deck[0].crypt[i];
            cardoptions[i] = this.app.crypto.decodeXOR(cardoptions[i], this.game.deck[0].keys[i]);
          }
          for (let i = 0; i < keysnum; i++) {
            cardoptions[i] = this.app.crypto.decodeXOR(cardoptions[i], this.game.queue[this.game.queue.length-keysnum+i]);
            cardoptions[i] = this.app.crypto.hexToString(cardoptions[i]);
          }
          for (let i = 0; i < keysnum; i++) {
            this.game.queue.splice(this.game.queue.length-1, 1);
          }


          let user_message = "Select cards to discard:";
          /*let html = "<ul>";
          for (let i = 0; i < cardoptions.length; i++) {
            html += `<li class="card card_${this.game.deck[0].crypt[i]}" id="${this.game.deck[0].crypt[i]}_${cardoptions[i]}">${this.game.deck[0].cards[cardoptions[i]].name}</li>`;
          }*/
          //html += '<li class="card dashed nocard" id="finished">Done discarding</li></ul>';
          cardoptions.push("finished");
          twilight_self.updateStatusAndListCards(user_message, cardoptions, false);

          //
          // cardoptions is in proper order
          //
          let cards_discarded = 0;

	        twilight_self.attachCardboxEvents(function(action2) {

            if (action2 == "finished") {

              for (let i = 0; i < pos_to_discard.length; i++) { 
                twilight_self.addMove(this.game.deck[0].crypt[pos_to_discard[i]]);
              }
              twilight_self.addMove("tehran\tus\t"+cards_discarded);
              twilight_self.endTurn();

            } else {

              pos_to_discard.push(cardoptions.indexOf(action2));
              cards_discarded++;
              $(`#${action2}.card`).hide();
              twilight_self.addMove("discard\tus\t"+action2);
              //twilight_self.addMove(`NOTIFY\tUS discards <span class="showcard" id="${tmpar[1]}">${twilight_self.game.deck[0].cards[tmpar[1]].name}</span>`);

            }
          });
        }

        shd_continue = 0;

      } else {

        //
        // us has sent keys to discard back
        //
        let removedcard = [];
        for (let i = 0; i < keysnum; i++) {
          removedcard[i] = this.game.queue[this.game.queue.length-1];
          this.game.queue.splice(this.game.queue.length-1, 1);
        }

        for (let i = 0; i < 5; i++) {
          if (removedcard.includes(this.game.deck[0].crypt[i])) {
            //
            // set cards to zero
            //
            this.game.deck[0].crypt[i] = "";
            this.game.deck[0].keys[i] = "";
          }
        }

        //
        // remove empty elements
        //
        var newcards = [];
        var newkeys  = [];
        for (let i = 0; i < this.game.deck[0].crypt.length; i++) {
          if (this.game.deck[0].crypt[i] != "") {
            newcards.push(this.game.deck[0].crypt[i]);
            newkeys.push(this.game.deck[0].keys[i]);
          }
        }

        //
        // keys and cards refreshed
        //
        this.game.deck[0].crypt = newcards;
        this.game.deck[0].keys = newkeys;

      }
    }

    //
    // limit [restriction] [region]
    //
    if (mv[0] == "limit") {
      if (mv[1] == "china") { this.game.state.events.china_card_in_play = 1; }
      if (mv[1] == "coups") { this.game.state.limit_coups = 1; }
      if (mv[1] == "spacerace") { this.game.state.limit_spacerace = 1; }
      if (mv[1] == "realignments") { this.game.state.limit_realignments = 1; }
      if (mv[1] == "placement") { this.game.state.limit_placement = 1; }
      if (mv[1] == "milops") { this.game.state.limit_milops = 1; }
      if (mv[1] == "ignoredefcon") { this.game.state.limit_ignoredefcon = 1; }
      if (mv[1] == "region") { this.game.state.limit_region.push(mv[2]); }
      this.game.queue.splice(qe, 1);
    }

    if (mv[0] == "flush") {
      if (mv[1] == "discards") {
        this.game.deck[0].discards = {};
      }
      this.game.queue.splice(qe, 1);
    }

    //
    // latinamericandebtcrisis
    //
    if (mv[0] == "latinamericandebtcrisis") {

      this.game.queue.splice(qe, 1);

      if (this.game.player == 1) {
        
        let potCountries = [];
        for (var i in this.countries) {
          if (this.countries[i].region == "samerica") {
            if (this.countries[i].ussr > 0) { 
              potCountries.push(i); 
            }
          }
        }
        
        if (potCountries.length == 0) {
          this.addMove("NOTIFY\tUSSR has no countries with influence to double");
          this.endTurn();
          return 0;
        }

        let countries_to_double = Math.min(2, potCountries.length);

        this.updateStatus("<div class='status-message' id='status-message'>Select "+countries_to_double+" countries in South America to double USSR influence</div>");

        //
        // double influence in two countries
        //
        for (var i of potCountries) {
          this.countries[i].place = 1;
          $("#"+i).addClass("easterneurope");
        }
         
        $(".easterneurope").off();
        $(".easterneurope").on('click', function() {

          let countryname = $(this).attr('id');

          if (twilight_self.countries[countryname].place == 1) {
            let ops_to_place = twilight_self.countries[countryname].ussr;
            twilight_self.placeInfluence(countryname, ops_to_place, "ussr");
            twilight_self.addMove("place\tussr\tussr\t"+countryname+"\t" + ops_to_place);
            twilight_self.countries[countryname].place = 0;
            countries_to_double--;
            if (countries_to_double == 0) {
              twilight_self.playerFinishedPlacingInfluence();
              twilight_self.endTurn();
            }
          } else {
            twilight_self.displayModal("Invalid Target","Already doubled influence");
          }
        });
        
      }else{
        this.updateStatus(`USSR is deciding which country to double their influence`);
      }
      return 0;
    }

    if (mv[0] == "northsea") {
      if (this.game.player == 1) {
        let html  = "US determining whether to take extra turn";
        this.updateStatus(html);
      }
      if (this.game.player == 2) {
        let user_message  = "Do you wish to take an extra turn?";
        let html = `<ul>
                    <li class="card" id="play">yes</li>
                    <li class="card" id="nope">no</li>
                    </ul>`;
        this.updateStatusWithOptions(user_message, html, false);

        twilight_self.attachCardboxEvents(function(action2) {

          if (action2 == "play") {
              twilight_self.addMove("resolve\tnorthsea");
              twilight_self.addMove("play\t2");
              twilight_self.endTurn();
          }
          if (action2 == "nope") {
              twilight_self.addMove("resolve\tnorthsea");
              twilight_self.addMove("play\t2");
              twilight_self.endTurn();
          }

        });
      }
      shd_continue = 0;
    }

        
    if (mv[0] == "space") {
      this.playerSpaceCard(mv[2], mv[1]);
      if (mv[2] != "china") {
        this.game.deck[0].discards[mv[2]] = this.game.deck[0].cards[mv[2]];
      }
      this.game.queue.splice(qe, 1);
    }


    if (mv[0] == "unlimit") {
      if (mv[1] == "china") { this.game.state.events_china_card_in_play = 0; }
      if (mv[1] == "cmc") { this.game.state.events.cubanmissilecrisis = 0; }
      if (mv[1] == "coups") { this.game.state.limit_coups = 0; }
      if (mv[1] == "spacerace") { this.game.state.limit_spacerace = 0; }
      if (mv[1] == "realignments") { this.game.state.limit_realignments = 0; }
      if (mv[1] == "placement") { this.game.state.limit_placement = 0; }
      if (mv[1] == "milops") { this.game.state.limit_milops = 0; }
      if (mv[1] == "ignoredefcon") { this.game.state.limit_ignoredefcon = 0; }
      if (mv[1] == "region") { this.game.state.limit_region = []; }
      this.game.queue.splice(qe, 1);
    }


    if (mv[0] == "chernobyl") {
      this.game.state.events.chernobyl = mv[1];
      this.game.queue.splice(qe, 1);
      
      if (this.game.player == 1){
        this.displayModal("Chernobyl",`Influence placements restricted in ${this.region_key[mv[1]]}`);
      }
    }

    //
    // burn die roll
    if (mv[0] == "dice") {
      if (mv[1] == "burn") {
        if (this.game.player == 1 && mv[2] == "ussr") {
          roll = this.rollDice(6);
        }
        if (this.game.player == 2 && mv[2] == "us")   {
          roll = this.rollDice(6);
        }
      }
      this.game.queue.splice(qe, 1);
    }

    //
    // aldrich ames
    if (mv[0] == "aldrichreveal") {

      if (this.game.player == 2) {

        let revealed = "", keys = "";
        for (let i = 0; i < this.game.deck[0].hand.length; i++) {
          if (i > 0) { 
            revealed += ", "; 
            keys += " ";
          }
          revealed += this.game.deck[0].cards[this.game.deck[0].hand[i]].name;
          keys += this.game.deck[0].hand[i];
        }

        if (this.game.deck[0].hand.length > 0 ) {
          this.addMove("showhand\t2\t"+keys);
          this.addMove("NOTIFY\tUS hand contains: "+revealed);
        } else {
          this.addMove("NOTIFY\tUS has no cards to reveal");
        }

        this.endTurn();
      }

      this.game.queue.splice(qe, 1);
      return 0;
    }

    if (mv[0] == "aldrich") {
      //
      // us telling ussr their hand, ussr picks a card to discard
      //
      if (mv[1] == "us") {

        let num = parseInt(mv[2]);
        let user_message = `${this.cardToText("aldrichames")}: USSR discard card from US hand:`;
        let uscards = [];
        this.game.queue.splice(qe, 1);

        for (let i = 0; i < num; i++) {
          uscards.push(this.game.queue.pop());
        }
        

        if (this.game.player == 2) {
          this.updateStatus(`<div class='status-message' id='status-message'>${this.cardToText("aldrichames")}: USSR choosing card to discard</div>`);
        }

        if (this.game.player == 1) {

          this.updateStatusAndListCards(user_message, uscards, false);

          twilight_self.attachCardboxEvents(function(action2) {
            twilight_self.addMove("aldrich\tussr\t"+action2);
            twilight_self.endTurn();
          });
        }

        return 0;
      }

      // ussr telling us which card to junk
      if (mv[1] == "ussr") {

        if (this.game.player == 2) {
          this.removeCardFromHand(mv[2]);
        }

        this.game.queue.splice(qe, 1);
        this.updateLog(`USSR forces US to discard ${this.cardToText(mv[2])}`);
        shd_continue = 1;
      }

    }

    if (mv[0] === "cambridge") {
      if (this.game.player == 1) {
        let placetxt = `<div class="status-message" id="status-message">${this.cardToText("cambridge")}: ${player.toUpperCase()} place 1 OP in`;
        for (let i = 1; i < mv.length; i++) {
          placetxt += " ";
          placetxt += this.cardToText(mv[i], true); //FIX Names

          for (var k in this.countries) {
            if (this.countries[k].region.includes(mv[i])) {
              $("#"+k).addClass("easterneurope");
            }
          }
        }
        
        $(".easterneurope").off();
        $(".easterneurope").on('click',function() {
          let countryname = $(this).attr('id');
          twilight_self.playerFinishedPlacingInfluence();
          twilight_self.placeInfluence(countryname, 1, "ussr");
          twilight_self.addMove("place\tussr\tussr\t"+countryname+"\t1");
          twilight_self.endTurn();
        });
        placetxt += '</div>';
        twilight_self.updateStatus(placetxt);

      }
      this.game.queue.splice(qe, 1);
      shd_continue = 0;
    }
     

    if (mv[0] === "teardownthiswall") {

      if (this.game.player == 1) {
        this.updateStatus("<div class='status-message' id='status-message'>US playing Tear Down This Wall</div>");
        return 0;

      }

      let user_message = "Tear Down this Wall is played -- US may make 3 OP free Coup Attempt or Realignments in Europe.";
      let html = `<ul>
          <li class="card" id="taketear">make coup or realign</li>
          <li class="card" id="skiptear">skip coup</li>
          </ul>`;
      twilight_self.updateStatusWithOptions(user_message, html,false);
      twilight_self.attachCardboxEvents(function(action2) {

        if (action2 == "skiptear") {
          twilight_self.updateStatus("<div class='status-message' id='status-message'>Skipping Tear Down this Wall...</div>");
          twilight_self.addMove("resolve\tteardownthiswall");
          twilight_self.endTurn();
        }

        if (action2 == "taketear") {
          twilight_self.addMove("resolve\tteardownthiswall");
          twilight_self.addMove("unlimit\tignoredefcon");
          twilight_self.addMove("unlimit\tregion");
          twilight_self.addMove("unlimit\tplacement");
          twilight_self.addMove("unlimit\tmilops");
          twilight_self.addMove("ops\tus\tteardown\t3");
          twilight_self.addMove("limit\tmilops");
          twilight_self.addMove("limit\tplacement");
          twilight_self.addMove("limit\tregion\tasia");
          twilight_self.addMove("limit\tregion\tseasia");
          twilight_self.addMove("limit\tregion\tmideast");
          twilight_self.addMove("limit\tregion\tsamerica");
          twilight_self.addMove("limit\tregion\tcamerica");
          twilight_self.addMove("limit\tregion\tafrica");
          twilight_self.addMove("limit\tignoredefcon");
          twilight_self.endTurn();
        }

      });

      shd_continue = 0;

    }


    if (mv[0] === "deal") {
      if (this.game.player == mv[1]) {
        let cards_needed_per_player = (this.game.state.round >= 4)? 9: 8;

        let my_cards = this.game.deck[0].hand.length;
        for (let z = 0; z < this.game.deck[0].hand.length; z++) {
          if (this.game.deck[0].hand[z] == "china") {
            my_cards--;
          }
        }
        let cards_needed = cards_needed_per_player - my_cards;

        this.addMove("resolve\tdeal");
        this.addMove("DEAL\t1\t"+mv[1]+"\t"+cards_needed);
        this.endTurn();
      }

      this.updateStatus("<div class='status-message' id='status-message'>"+player.toUpperCase() + " is fetching new cards</div>");
      return 0;
    }


    if (mv[0] === "reshuffle"){
        this.game.queue.splice(qe, 1);
        let reshuffle_limit = 14;
        let cards_needed_per_player = (this.game.state.round >= 4)? 9 : 8;

        let ussr_cards = this.game.deck[0].hand.length;
        let us_cards   = this.game.state.opponent_cards_in_hand; //Already filtered China card

        for (let z = 0; z < this.game.deck[0].hand.length; z++) {
          if (this.game.deck[0].hand[z] == "china") {
            ussr_cards--;
          }
        }
      
        if (this.game.player == 2) {
          let x = ussr_cards;
          ussr_cards = us_cards;
          us_cards = x;
        }

        let us_cards_needed = cards_needed_per_player - us_cards;
        let ussr_cards_needed = cards_needed_per_player - ussr_cards;
        reshuffle_limit = us_cards_needed + ussr_cards_needed;

        if (this.game.deck[0].crypt.length < reshuffle_limit) {

          // no need to reshuffle in turn 4 or 8 as we have new cards inbound
          if (this.game.state.round != 4 && this.game.state.round != 8) {
            console.log("Need to reshuffle: ");

            // this resets discards = {} so that DECKBACKUP will not retain
            let discarded_cards = this.returnDiscardedCards();

            // shuttle diplomacy
            if (this.game.state.events.shuttlediplomacy == 1) {
              if (discarded_cards['shuttle'] != undefined) {
                delete discarded_cards['shuttle'];
              }
            }


            if (Object.keys(discarded_cards).length > 0) {

              // shuffle in discarded cards
              this.game.queue.push("SHUFFLE\t1");
              this.game.queue.push("DECKRESTORE\t1");
              this.game.queue.push("DECKENCRYPT\t1\t2");
              this.game.queue.push("DECKENCRYPT\t1\t1");
              this.game.queue.push("DECKXOR\t1\t2");
              this.game.queue.push("DECKXOR\t1\t1");
              this.game.queue.push("DECK\t1\t"+JSON.stringify(discarded_cards));
              this.game.queue.push("DECKBACKUP\t1");
              this.updateLog("Shuffling discarded cards back into the deck...");

            }

            //
            // deal existing cards *evenly* before
            // we shuffle the discards into the
            // deck
            //
            let cards_available = this.game.deck[0].crypt.length;
            let player2_cards = Math.floor(cards_available / 2);
            let player1_cards = cards_available - player2_cards;;

            //
            // adjust distribution of cards
            if (player2_cards > us_cards_needed) {
              let surplus_cards = player2_cards - us_cards_needed;
              player2_cards = us_cards_needed;
              player1_cards += surplus_cards;
            }

            if (player1_cards > ussr_cards_needed) {
              let surplus_cards = player1_cards - ussr_cards_needed;
              player1_cards = ussr_cards_needed;
              player2_cards += surplus_cards;
            }

            if (player1_cards > 0) {
              this.game.queue.push("DEAL\t1\t2\t"+player2_cards);
              this.game.queue.push("DEAL\t1\t1\t"+player1_cards);
            }
            this.updateStatus("<div class='status-message' id='status-message'>Dealing remaining cards from draw deck before reshuffling...</div>");
            this.updateLog(`Dealing ${cards_available} remaining cards from draw deck before reshuffling...`);

          }

        }


    }

    // player | card | op
    if (mv[0] === "ops") {

      if (this.game.deck[0].cards[mv[2]] != undefined) { this.game.state.event_name = this.cardToText(mv[2]); }

      this.updateLog(mv[1].toUpperCase() + ` plays ${this.game.state.event_name} for ${mv[3]} OPS`);

      // stats
      if (mv[1] == "us") { this.game.state.stats.us_ops += parseInt(mv[3]); }
      if (mv[1] == "ussr") { this.game.state.stats.ussr_ops += parseInt(mv[3]); }
      
  	  if (this.game.deck[0].cards[mv[2]] != undefined) {
  	    if (this.game.deck[0].cards[mv[2]].player == "us") {
  	      if (mv[1] == "ussr") {
  	        this.game.state.stats.ussr_us_ops += parseInt(mv[3]);
  	      }
  	      if (mv[1] == "us") {
  	        this.game.state.stats.us_us_ops += parseInt(mv[3]);
  	      }
  	    }
  	    if (this.game.deck[0].cards[mv[2]].player == "ussr") {
  	      if (mv[1] == "ussr") {
  	        this.game.state.stats.ussr_ussr_ops += parseInt(mv[3]);
  	      }
  	      if (mv[1] == "us") {
  	        this.game.state.stats.us_ussr_ops += parseInt(mv[3]);
  	      }
  	    }
  	    if (this.game.deck[0].cards[mv[2]].player == "both") {
  	      if (mv[1] == "ussr") {
  	        this.game.state.stats.ussr_neutral_ops += parseInt(mv[3]);
  	      }
  	      if (mv[1] == "us") {
  	        this.game.state.stats.us_neutral_ops += parseInt(mv[3]);
  	      }
  	    }
  	  }

      // unset formosan if China card played by US
      if (mv[1] == "us" && mv[2] == "china") {
        this.game.state.events.formosan = 0;
        $('.formosan').hide();
      }

      this.playOps(mv[1], parseInt(mv[3]), mv[2]);
      shd_continue = 0;
    }
   

    if (mv[0] === "milops") {
      this.updateLog(mv[1].toUpperCase() + " receives " + mv[2] + " milops");
      if (mv[1] === "us") {
        this.game.state.milops_us += parseInt(mv[2]);
      } else {
        this.game.state.milops_ussr += parseInt(mv[2]);
      }
      this.updateMilitaryOperations();
      this.game.queue.splice(qe, 1);
    }


    if (mv[0] === "vp") {
      if (mv.length > 3) {
        if (parseInt(mv[3]) == 1) {
          this.updateLog(mv[1].toUpperCase() + " receives " + mv[2] + " VP", 1);
          if (mv[1] === "us") {
            this.game.state.vp_outstanding += parseInt(mv[2]);
          } else {
            this.game.state.vp_outstanding -= parseInt(mv[2]);
          }
        } else {
          if (mv[1] === "us") {
            this.game.state.vp += parseInt(mv[2]);
          } else {
            this.game.state.vp -= parseInt(mv[2]);
          }
        }
      } else {
        this.updateLog(mv[1].toUpperCase() + " receives " + mv[2] + " VP");
        if (mv[1] === "us") {
          this.game.state.vp += parseInt(mv[2]);
        } else {
          this.game.state.vp -= parseInt(mv[2]);
        }
        this.updateVictoryPoints();
      }
      this.game.queue.splice(qe, 1);
    }


    if (mv[0] === "coup") {

      let card = "";
      if (mv.length >= 5) { card = mv[4]; }

      this.updateLog(mv[1].toUpperCase() + " coups " + this.countries[mv[2]].name + " with " + mv[3] + " OPS");

      if (this.game.state.limit_milops != 1) {
        //
        // modify ops is handled incoherently with milops, so we calculate afresh here
        //
        // reason is that modify ops is run before submitting coups sometimes and sometimes now
        //
        if (mv[1] == "us") { this.game.state.milops_us += this.modifyOps(parseInt(mv[3]), card, "us"); }
        if (mv[1] == "ussr") { this.game.state.milops_ussr += this.modifyOps(parseInt(mv[3]), card, "ussr"); }

        this.updateMilitaryOperations();
      }
      //
      // do not submit card, ops already modified
      //
      this.playCoup(mv[1], mv[2], parseInt(mv[3]));
      this.game.queue.splice(qe, 1);
    }


    if (mv[0] === "realign") {
      if (mv[1] != player) { //Other player needs to "check the math" 
        this.playRealign(mv[1], mv[2]);
      }

      this.game.queue.splice(qe, 1);
    }

    if (mv[0] === "defcon") {
      if (mv[1] === "lower") {
console.log("MONITORING DEFCON: in defcon instruction in gameloop");
        this.lowerDefcon();
      }
      if (mv[1] === "raise") {
        this.game.state.defcon++;
        if (this.game.state.defcon > 5) { this.game.state.defcon = 5; }
        this.updateDefcon();
      }
      this.game.queue.splice(qe, 1);
    }

        
    if (mv[0] === "move") {
      if (mv[1] == "ussr") { this.game.state.move = 0; }
      if (mv[1] == "us") { this.game.state.move = 1; }
      this.game.queue.splice(qe, 1);
    }


    if (mv[0] === "event") {

      if (this.game.deck[0].cards[mv[2]] != undefined) { this.game.state.event_name = this.cardToText(mv[2]); }
      this.updateLog(mv[1].toUpperCase() + ` triggers ${this.game.state.event_name} as an event`);

      shd_continue = this.playEvent(mv[1], mv[2]);

      //
      // show active events
      //
      this.updateEventTiles();

      if (shd_continue == 0) {
        //
        // game will stop
        //
        //this.game.saveGame(this.game.id);
      } else {
        //
        // only continue if we do not stop
        //
        if (mv[1] != "china") { //China card gets processed seperately
          //
          // remove non-recurring events from game
          //
          for (var i in this.game.deck[0].cards) {
            if (mv[2] == i) {
              if (this.game.deck[0].cards[i].recurring != 1) {

                let event_removal = 1;

                //
                // Wargames not removed if DEFCON > 2
                //
                if (this.game.state.defcon > 2 && mv[2] == "wargames") {
                  event_removal = 0;
                }

                //
                // NATO not removed if prerequisitcs not met
                //
                if (this.game.state.events.nato == 0 && mv[2] == "nato") {
                  event_removal = 0;
                }

                //
                // Solidarity not removed if Pope John Paul II not in play
                //
                if (this.game.state.events.johnpaul == 0 && mv[2] == "solidarity") {
                  event_removal = 0;
                }

                //
                // Star Wars not removed if not triggered
                //
                if (this.game.state.events.starwars == 0 && mv[2] == "starwars") {
                  event_removal = 0;
                }

                //
                // Our Man in Tehran not removed if not triggered
                //
                if (this.game.state.events.ourmanintehran == 0 && mv[2] == "ourmanintehran") {
                  event_removal = 0;
                }

                //
                // Kitchen Debates not removed if not triggered
                //
                if (this.game.state.events.kitchendebates == 0 && mv[2] == "kitchendebates") {
                  event_removal = 0;
                }


                if (event_removal == 1) {
                  this.updateLog(this.cardToText(i) + " removed from game");
                  this.game.deck[0].removed[i] = this.game.deck[0].cards[i];
                  delete this.game.deck[0].cards[i];
                } else {
                  // just discard -- NATO catch mostly
                  this.updateLog(this.cardToText(i) + " discarded");
                  this.game.deck[0].discards[i] = this.game.deck[0].cards[i];
                }
              } else {
                this.updateLog(this.cardToText(i) + " discarded");
                this.game.deck[0].discards[i] = this.game.deck[0].cards[i];
              }
            }
          }
        }

        // delete event if not deleted already
        this.game.queue.splice(qe, 1);
      }
    }


    if (mv[0] === "stability") {
      let p = mv[1];
      let c = mv[2];
      let adj = parseInt(mv[3]);
  	  if (this.countries[c] != undefined) {
  	    this.countries[c].control += adj;
  	    this.updateLog(this.countries[c].name + " stability is now " + this.countries[c].control);
  	  }
      this.game.queue.splice(qe, 1);
    }


    if (mv[0] === "place") {
      if (player !== mv[1]) { this.placeInfluence(mv[3], parseInt(mv[4]), mv[2]); }
      this.game.queue.splice(qe, 1);
    }

    if (mv[0] === "setvar") {
      if (this.game.player != mv[1]) {
  	    if (mv[2] == "opponent_cards_in_hand") {
          this.game.state.opponent_cards_in_hand = parseInt(mv[3]);
        }
        if (mv[3]) {
           if (mv[3] == "back_button_cancelled") {
              this.game.state.back_button_cancelled = parseInt(mv[4]);
           }
        }
      }
      this.game.queue.splice(qe, 1);
    }


    if (mv[0] === "remove") {
      if (player != mv[1]) { this.removeInfluence(mv[3], parseInt(mv[4]), mv[2]); }
      this.game.queue.splice(qe, 1);
    }
    

    if (mv[0] === "resolve") {

      //
      // eliminate junta
      //
      if (mv[1] === "junta") { this.game.state.events.junta = 0; }

      if (qe == 0) {
          this.game.queue = [];
      } else {

        let le = qe-1;

        //
        // resolving UN intervention means disabling the effect
        //
        if (mv[1] == "unintervention") {

  	      //
  	      // if u2 in play, give extra VP
  	      //
  	      if (this.game.state.events.u2 == 1) {
        		this.updateLog("USSR gains +1 VP bonus from U2 Intervention");
        		this.game.state.vp--;
  	        this.updateVictoryPoints();
  	      }

          //
          // UNIntervention causing issues with USSR when US plays
          // force the event to reset in ALL circumstances
          this.game.state.events.unintervention = 0;

          let lmv = this.game.queue[le].split("\t");
          if (lmv[0] == "event" && lmv[2] == mv[1]) {
            this.game.state.events.unintervention = 0;
          }

        }

        //
        // we can remove the event if it is immediately above us in the queue
        //
        if (le <= 0) {
          this.game.queue = ["round"]; // shd be first
        } else {

          let lmv = this.game.queue[le].split("\t");
          let rmvd = 0;

  	      if (lmv[0] === "OBSERVER_CHECKPOINT" && le >= 1) {
        		let tmp = this.game.queue[le];
	          this.game.queue[le] = this.game.queue[le-1];
		        this.game.queue[le-1] = tmp; 		
            lmv = this.game.queue[le].split("\t");
	        }

          if (lmv[0] == "headline" && mv[1] == "headline") {
            this.game.queue.splice(le, 2);
            rmvd = 1;
          }
          if (lmv[0] == "ops" && mv[1] == "ops") {
            this.game.queue.splice(le, 2);
            rmvd = 1;
          }
          if (lmv[0] == "play" && mv[1] == "play") {
            this.game.queue.splice(le, 2);
            rmvd = 1;
          }
          if (lmv[0] == "event" && lmv[2] == mv[1]) {
            this.game.queue.splice(le, 2);
            rmvd = 1;
          }
          if (lmv[0] == "placement" && mv[1] == "placement") {
            this.game.queue.splice(le, 2);
            rmvd = 1;
          }
          if (lmv[0] == "placement_bonus" && mv[1] == "placement_bonus") {
            this.game.queue.splice(le, 2);
            rmvd = 1;
          }
          if (lmv[0] == "deal" && mv[1] == "deal") {
            this.game.queue.splice(le, 2);
            rmvd = 1;
          }
          if (lmv[0] == "discard" && lmv[2] == mv[1]) {
            this.game.queue.splice(qe, 1);
            rmvd = 1;
          }
          if (lmv[0] === mv[1]) {	// "discard teardownthiswall"
            this.game.queue.splice(le, 2);
            rmvd = 1;
          }
          if (rmvd == 0) {
            //
            // remove the event
            //
            this.game.queue.splice(qe, 1);
            //
            // go back through the queue and remove the first event that matches this one
            //
            for (let z = le, zz = 1; z >= 0 && zz == 1; z--) {
              let tmplmv = this.game.queue[z].split("\t");
              if (tmplmv.length > 0) {
                if (tmplmv[0] === "event") {
                  if (tmplmv.length > 2) {
                    if (tmplmv[2] === mv[1]) {
                      this.game.queue.splice(z);
                      zz = 0;
                    }
                  }
                }

                //
          	    // may need to remove deal
                if (tmplmv[0] === "deal" && mv[1] == "deal") {
                  this.game.queue.splice(z);
                  zz = 0;
        		    }
              }
            }
          }
        }
      }

      //
      // remove non-recurring events from game
      //
      for (var i in this.game.deck[0].cards) {
        if (mv[1] == i) {
          if (this.game.deck[0].cards[i].recurring != 1) {
            this.updateLog(this.cardToText(i) + " removed from game");
            this.game.deck[0].removed[i] = this.game.deck[0].cards[i];
            delete this.game.deck[0].cards[i];
          } else {
            this.updateLog(this.cardToText(i) + " discarded");
            this.game.deck[0].discards[i] = this.game.deck[0].cards[i];
          }
        }
      }
    }


    if (mv[0] === "clear"){
      this.game.queue.splice(qe, 1);
      if (mv[1] == "headline"){
        // it is no longer the headline
        this.game.state.headline = 0;
        this.game.state.headline_card = "";
        this.game.state.headline_xor = "";
        this.game.state.headline_hash = "";
        this.game.state.headline_opponent_hash = "";
        this.game.state.headline_opponent_xor = "";
        this.game.state.headline_opponent_card = "";
        return 1;
      }
    }

    if (mv[0] === "placement") {

      //
      // TESTING
      //
      // if you want to hardcode the hands of the players, you can set
      // them manually here. Be sure that all of the cards have been
      // dealt ento the DECK during the setup phase though.
      //

      if (this.is_testing == 1) {
        if (this.game.player == 2) {
          this.game.deck[0].hand = ["asknot", "containment", "oas", "duckandcover", "abmtreaty", "howilearned", "asia", "europe", "naziscientist"];
        } else {
          this.game.deck[0].hand = ["liberation", "junta", "norad", "che", "vietnamrevolts", "marine", "debtcrisis", "arabisraeli", "china"];
        }
      }

      //
      // add china card to deck and make sure it is in USSR's hand
      //
      this.game.deck[0].cards["china"] = this.returnChinaCard();
      if (this.game.player == 1) {
        let hand_contains_china = 0;
        for (let x = 0; x < this.game.deck[0].hand.length; x++) {
          if (this.game.deck[0].hand[x] == "china") { hand_contains_china = 1; }
        }
        if (hand_contains_china == 0) {
          if (!this.game.deck[0].hand.includes("china")) {
            this.game.deck[0].hand.push("china");
          }
        }
      }

      if (this.is_testing && this.game.player == mv[1]){
        this.addMove("resolve\tplacement");
        if (this.game.player == 1){
          this.addMove("place\tussr\tussr\tpoland\t3");
          this.addMove("place\tussr\tussr\tfinland\t3");
          this.placeInfluence("poland", 3, "ussr");
          this.placeInfluence("finland", 3, "ussr");
        }else{
          this.addMove("place\tus\tus\twestgermany\t3");
          this.addMove("place\tus\tus\tfrance\t3");
          this.addMove("place\tus\tus\titaly\t1");
          this.placeInfluence("westgermany", 3, "us");
          this.placeInfluence("france", 3, "us");
          this.placeInfluence("italy", 1, "us");
        }
        this.endTurn();
        return 0;
      }

      
      if (this.game.player == mv[1]) {
        this.playerPlaceInitialInfluence();
      } else {
        this.updateStatusAndListCards(`${(mv[1] == 1)?"USSR":"US"} is making its initial placement of influence:`);
      }
      
      // do not remove from queue -- handle RESOLVE on endTurn submission
      return 0;
    }


    if (mv[0] === "placement_bonus") {
      //Only the US gets a placement_bonus

      if (this.game.player == mv[1]) {
        this.playerPlaceBonusInfluence(mv[2]);
      } else {
        this.updateStatusAndListCards(`${(mv[1] == 1)?"USSR":"US"} is making its bonus placement of ${mv[2]} influence`);
      }

      // do not remove from queue -- handle RESOLVE on endTurn submission
      return 0;
    }

    if (mv[0] === "headline") {

      let stage  = mv[1] || "headline1";
      let hash   = mv[2] || "";
      let xor    = mv[3] || "";
      let card   = mv[4] || "";

      this.game.state.headline = 1;

      let x = this.playHeadlinePostModern(stage, hash, xor, card);
      //
      // do not remove from queue -- handle RESOLVE on endTurn submission
      //
      return 0;

    }


    if (mv[0] === "round") {

      //
      // china card is face-up
      //
      this.game.state.events.china_card_facedown = 0;

      //
      // reset / disable aldrich
      //
      this.game.state.events.aldrich = 0;

      //
      // END OF HISTORY
      //
      this.game.state.events.inftreaty = 0;

      //
      // NORAD -- we check here in case the final move of the round triggers it
      //
console.log("CHECKING US DEFCON BONUS 1");
      if (this.game.state.us_defcon_bonus == 1) {
        //
        // prevent DEFCON bonus from repeating when we bounce back to "round"
        //
        this.game.state.us_defcon_bonus = 0;

console.log("CHECKING CANADA CONTROLLED 1");
        if (this.isControlled("us", "canada") == 1) {

console.log("EXECUTING NORAD");
          this.updateLog("NORAD triggers: US places 1 influence in country with US influence");

          if (this.game.player == 1) {
            this.updateStatus("<div class='status-message' id='status-message'>NORAD triggers: US places 1 influence in country with US influence</div>");
            return 0;
          } else {

            for (var i in this.countries) {
              if (this.countries[i].us > 0) {
                $("#"+i).addClass("westerneurope");
              }
            }
        
            this.updateStatus("<div class='status-message' id='status-message'>Place your NORAD bonus: (1 OP)</div>");

            $(".westerneurope").off();
            $(".westerneurope").on('click', function() {

              // no need for this end-of-round
              // twilight_self.addMove("resolve\tturn");

              let countryname = $(this).attr('id');
              twilight_self.addMove("place\tus\tus\t"+countryname+"\t1");
              twilight_self.placeInfluence(countryname, 1, "us");
              twilight_self.playerFinishedPlacingInfluence();
              twilight_self.endTurn();
            });

          }
          return 0;
        }
      }

      

  	  // STATS - aggregate the statisics
  	  if (this.game.state.round > 1) {
  	    this.game.state.stats.round.push({});
  	    this.game.state.stats.round[this.game.state.stats.round.length-1].us_scorings = this.game.state.stats.us_scorings;
  	    this.game.state.stats.round[this.game.state.stats.round.length-1].ussr_scorings = this.game.state.stats.ussr_scorings;
  	    this.game.state.stats.round[this.game.state.stats.round.length-1].us_ops = this.game.state.stats.us_ops;
  	    this.game.state.stats.round[this.game.state.stats.round.length-1].ussr_ops = this.game.state.stats.ussr_ops;
  	    this.game.state.stats.round[this.game.state.stats.round.length-1].us_us_ops = this.game.state.stats.us_ops;
  	    this.game.state.stats.round[this.game.state.stats.round.length-1].ussr_us_ops = this.game.state.stats.ussr_ussr_ops;
  	    this.game.state.stats.round[this.game.state.stats.round.length-1].us_ussr_ops = this.game.state.stats.us_ussr_ops;
  	    this.game.state.stats.round[this.game.state.stats.round.length-1].ussr_ussr_ops = this.game.state.stats.ussr_ussr_ops;
  	    this.game.state.stats.round[this.game.state.stats.round.length-1].us_neutral_ops = this.game.state.stats.us_neutral_ops;
  	    this.game.state.stats.round[this.game.state.stats.round.length-1].ussr_neutral_ops = this.game.state.stats.ussr_neutral_ops;
  	    this.game.state.stats.round[this.game.state.stats.round.length-1].vp = this.game.state.vp;
  	  }

      //
      // settle outstanding VP issue
      //
      this.settleVPOutstanding();


      //
      // show active events
      //
      this.updateEventTiles();

      if (this.game.state.events.northseaoil_bonus == 1) {
        //
        // prevent North Sea Oil bonus from carrying over to next round
        //
        this.game.state.events.northseaoil_bonus = 0;
        
        if (this.game.player == 1) {
          this.updateStatus("<div class='status-message' id='status-message'>US is deciding whether to take extra turn</div>");
          return 0;
        }

        //
        // US gets extra move
        //
        let html  = `<ul>
                    <li class="card" id="play">play extra turn</li>
                    <li class="card" id="nope">do not play</li>
                    </ul>`;
        this.updateStatusWithOptions(`Do you want to take an extra turn? (North Sea Oil)`,html,false);

        twilight_self.attachCardboxEvents(function(action2) {

          if (action2 == "play") {
            twilight_self.addMove("play\t2");
            twilight_self.endTurn(1);
          }
          if (action2 == "nope") {
            twilight_self.addMove("NOTIFY\tUS does not play extra turn");
            twilight_self.endTurn(1);
          }

        });

        return 0;

      }

      //
      // Eagle/Bear Has Landed -- Player can discard a held card
      //
      if (this.game.state.eagle_has_landed != "" && this.game.state.eagle_has_landed_bonus_taken == 0 && this.game.state.round > 0) {

        this.game.state.eagle_has_landed_bonus_taken = 1;

        let bonus_player = (this.game.state.eagle_has_landed == "us") ? 2 : 1;
    
        if (this.game.player != bonus_player) {
          this.updateStatus('<div class="status-message" id="status-message">' + this.game.state.eagle_has_landed.toUpperCase() + " is deciding whether to discard a card</div>");
          return 0;
        }

  	    let available_cards = [];
  	    for (let i = 0; i < this.game.deck[0].hand.length; i++) {
  	      let thiscard = this.game.deck[0].hand[i];
  	      if (thiscard != "europe" && thiscard != "asia" && thiscard != "mideast" && thiscard != "seasia" && thiscard != "camerica" && thiscard != "samerica" && thiscard != "africa" && thiscard != "china") {
  	        available_cards.push(thiscard);
  	      }
  	    }

  	    //
        // if we have no cards, skip
  	    //
        if (available_cards.length == 0) {
  	      this.updateLog("No cards in hand, skipping end-of-turn discard");
  	      this.addMove("NOTIFY\tSkipping Eagle / Bear has Landed");
  	      this.endTurn();
  	    }else{
          //
          // DISCARD CARD
          //
          let user_message = `${this.game.state.eagle_has_landed.toUpperCase()} may discard a card: (${(bonus_player == 1)?"Bear":"Eagle"} Has Landed)`;
          let html = `<ul>`;
          for (let i = 0; i < available_cards.length; i++) {
            html += `<li class="card" id="${available_cards[i]}">${twilight_self.game.deck[0].cards[available_cards[i]].name}</li>`;
          }
          html +=    `<li class="card dashed nocard" id="nope">do not discard</li>
                      </ul>`;
                    
          this.updateStatusWithOptions(user_message, html, false);

          twilight_self.attachCardboxEvents(function(action2) {

            if (action2 == "nope") {
              twilight_self.addMove("NOTIFY\t"+twilight_self.game.state.eagle_has_landed.toUpperCase()+" does not discard a card");
              twilight_self.endTurn(1);
            } else {
              $(`#${action2}.card`).hide(); 
              twilight_self.hideCard();
              twilight_self.updateStatus("<div class='status-message' id='status-message'>Discarding...</div>");
              twilight_self.removeCardFromHand(action2);
              twilight_self.addMove("discard\t"+twilight_self.game.state.eagle_has_landed+"\t"+action2);
              twilight_self.addMove("NOTIFY\t"+twilight_self.game.state.eagle_has_landed.toUpperCase()+` discards ${twilight_self.cardToText(action2)}`);
              twilight_self.endTurn(1);
              return 0;
            }
          });
        }

        return 0;
      }



      //
      // Space Station
      //
      if (this.game.state.space_station != "" && this.game.state.space_station_bonus_taken == 0 && this.game.state.round > 0) {

        this.game.state.space_station_bonus_taken = 1;

        let bonus_player = (this.game.state.space_station == "us") ? 2 : 1;

        if (this.game.player != bonus_player) {
          this.updateStatus(this.game.state.space_station.toUpperCase() + " is deciding whether to take extra turn");
          return 0;
        }

        //
        // player gets extra move
        //
        let html  = `<ul><li class="card" id="play">play extra turn</li>
                     <li class="card" id="nope">do not play</li></ul>`;
        this.updateStatusWithOptions("Do you want to take an extra turn: (Space Shuttle)",html,false);

        twilight_self.attachCardboxEvents(function(action2) {
          if (action2 == "play") {
            twilight_self.addMove("play\t"+bonus_player);
            twilight_self.endTurn(1);
          }
          if (action2 == "nope") {
            twilight_self.addMove("NOTIFY\t"+twilight_self.game.state.space_station.toUpperCase()+" does not play extra turn");
            twilight_self.endTurn(1);
          }
        });

        return 0;

      }


      //
      // if we have come this far, move to the next turn
      //
      if (this.game.state.round > 0) {
        this.updateLog("End of Round");
      }

      //Increment state.round and resets state variables for next round
      if (!this.endRound()){return 0;} 

      //
      // END GAME IF WE MAKE IT !
      //
      if (this.game.state.round == 11) {
        this.finalScoring();
        return 0; //Stop running through the queue
      }

      this.updateStatus("<div class='status-message' id='status-message'>Preparing for round " + this.game.state.round+"</div>");

      let rounds_in_turn = 6;
      if (this.game.state.round > 3) { rounds_in_turn = 7; }

      for (let i = 0; i < rounds_in_turn; i++) {
        this.game.queue.push("turn");
        this.game.queue.push("play\t2");
        this.game.queue.push("play\t1");
      }

      this.game.queue.push("headline");
      //this.game.queue.push("update_observers\t2");
      //this.game.queue.push("update_observers\t1");
      

      //
      // DEAL MISSING CARDS
      //
      if (this.game.state.round > 1) {

        this.updateLog(this.game.deck[0].crypt.length + " cards remaining in deck...");

        this.game.queue.push("deal\t2");
        this.game.queue.push("deal\t1");  

        this.game.queue.push("reshuffle");
        this.game.queue.push("sharehandsize\t2");
        this.game.queue.push("sharehandsize\t1");



        if (this.game.state.round == 4) {

          this.game.queue.push("SHUFFLE\t1");
          this.game.queue.push("DECKRESTORE\t1");
          this.game.queue.push("DECKENCRYPT\t1\t2");
          this.game.queue.push("DECKENCRYPT\t1\t1");
          this.game.queue.push("DECKXOR\t1\t2");
          this.game.queue.push("DECKXOR\t1\t1");
          this.game.queue.push("DECK\t1\t"+JSON.stringify(this.returnMidWarCards()));
          this.game.queue.push("DECKBACKUP\t1");
          this.updateLog("Adding Mid War cards to the deck...");

        }

        if (this.game.state.round == 8) {

          this.game.queue.push("SHUFFLE\t1");
          this.game.queue.push("DECKRESTORE\t1");
          this.game.queue.push("DECKENCRYPT\t1\t2");
          this.game.queue.push("DECKENCRYPT\t1\t1");
          this.game.queue.push("DECKXOR\t1\t2");
          this.game.queue.push("DECKXOR\t1\t1");
          this.game.queue.push("DECK\t1\t"+JSON.stringify(this.returnLateWarCards()));
          this.game.queue.push("DECKBACKUP\t1");
          this.updateLog("Adding Late War cards to the deck...");

        }
      }

      return 1;
    }


    if (mv[0] === "play") {

      if (this.game.player == 0) {
        this.game.queue.push("OBSERVER_CHECKPOINT");
      }

      //
      // copy for reversion
      //
      try {
        start_turn_game_state = JSON.parse(JSON.stringify(this.game.state));
        start_turn_game_queue = JSON.parse(JSON.stringify(this.game.queue));
      } catch (err) {
        start_turn_game_state = null;
        start_turn_game_queue = null;
      }


      //
      // resolve outstanding VP
      this.settleVPOutstanding();

      //
      // show active events
      this.updateEventTiles();

      //keep track of phasing player
      this.game.state.turn = parseInt(mv[1]);

      //
      // deactivate cards
      this.game.state.events.china_card_eligible = 0;
	    this.displayChinaCard();

      //
      // back button functions again
      this.game.state.back_button_cancelled = 0;

      //
      // NORAD -- NEEDS TESTING
      //
console.log("CHECKING US DEFCON BONUS 2");
      if (this.game.state.us_defcon_bonus == 1) {
        this.game.state.us_defcon_bonus = 0;
console.log("CHECKING CANADA CONTROLLED 2");
        if (this.isControlled("us", "canada") == 1) {
console.log("YES, RUNNING DEFCON 2");

          let twilight_self = this;
          
          this.updateLog("NORAD triggers: US places 1 influence in country with US influence");
          /*
          This is the block of code that gets called for NORAD
          */
          if (this.game.player == 1) { //USSR waits for US to move
            this.updateStatus("<div class='status-message' id='status-message'>NORAD triggers: US places 1 influence in country with US influence</div>");  
            return 0;
          }else{
            
            for (var i in this.countries) {
              if (this.countries[i].us > 0) {
                $("#"+i).addClass("westerneurope");
              }
            }
                  
            this.updateStatus("<div class='status-message' id='status-message'>US place NORAD bonus: (1 OP)</div>");

            $(".westerneurope").off();
            $(".westerneurope").on('click', function() {
              let countryname = $(this).attr('id');

              twilight_self.addMove("resolve\tturn");
              twilight_self.addMove("place\tus\tus\t"+countryname+"\t1");

              twilight_self.placeInfluence(countryname, 1, "us", function() {
              twilight_self.playerFinishedPlacingInfluence();
              twilight_self.endTurn();
              });
            });
          }
          return 0;
        } 
      }
      
      this.displayBoard();

      this.playMove();
      return 0;
    }

    /* */
    if (mv[0] === "showhand") {
      this.game.queue.splice(qe, 1);
      let whosehand = parseInt(mv[1]);
      let cards_to_reveal = mv[2].split(" ");

      let title = (whosehand == 1)? "USSR Hand" : "US Hand";
      if (this.game.player != whosehand){
        this.showCardOverlay(cards_to_reveal, title);
      }

      return 1;
    }


    if (mv[0] === "modal"){
      this.game.queue.splice(qe, 1);
      this.displayModal(mv[1],mv[2]);
      return 1;
    }


    if (mv[0] === "sharehandsize"){
      let player = parseInt(mv[1]);
      this.game.queue.splice(qe, 1);

      if (this.game.player == player){
        let cards_in_hand = this.game.deck[0].hand.length;
        for (let z = 0; z < this.game.deck[0].hand.length; z++) {
          if (this.game.deck[0].hand[z] == "china") {
            cards_in_hand--;
          }
        }
        this.addMove("setvar\t"+this.game.player+"\topponent_cards_in_hand\t"+cards_in_hand);
        this.endTurn();
      }
   
      return 0;
    }

    //twilight_self.addMove(`war\t${card}\t${winner}\t${die}\t${modifications}\t${player}`);
    if (mv[0] === "war"){
      let sponsor = mv[5] || "";
      this.showWarOverlay(mv[1],mv[2],parseInt(mv[3]),parseInt(mv[4]),sponsor);
      this.game.queue.splice(qe, 1);
      return 1;
    }


    //
    // avoid infinite loops
    //
    if (shd_continue == 0) {
      console.log("NOT CONTINUING");
      return 0;
    }


    } // if cards in queue
    return 1;

  }

  /************** END OF GAME LOOP **************/

  playHeadlinePostModern(stage, hash="", xor="", card="") {  
     if (this.game.player === 0) {
      this.updateLog("Processing Headline Cards...");
      return;
    }

    // NO HEADLINE PEEKING
    if (this.game.state.man_in_earth_orbit == "") {
      if (stage == "headline1"){
        console.log("Launching simultaneous pick of headline cards");
        //Directly push these, so only a single copy is added to queue
        this.game.queue.push("resolve\theadline");
        this.game.queue.push("headline\theadline4");

        this.playerPickHeadlineCard();  //Players simultaneously pick their headlines
        return 0;

      }else if (stage == "headline4"){
        console.log("Finishing simultaneous pick of headline cards");
        //We should have results back from simultaneous pick
        //stored in -- game_self.game.state.sp[player_id - 1] = player_card;
        
        this.game.state.headline_opponent_card = this.game.state.sp[2-this.game.player];
        console.log(JSON.parse(JSON.stringify(this.game.state.sp)));
        console.log(this.game.state.headline_card,this.game.state.headline_opponent_card);
        stage = "headline6";
      }
    }else{ // man in earth orbit = HEADLINE PEEKING
      
      let first_picker = 2;
      let second_picker = 1;
      let playerside = "US";

      if (this.game.state.man_in_earth_orbit === "us") { first_picker = 1; second_picker = 2; playerside = "USSR"; }

      // first player sends card
      if (stage == "headline1") {
        this.updateLog(playerside + " selecting headline card first");
        
        if (this.game.player == first_picker) {
          this.addMove("resolve\theadline");
          this.playerPickHeadlineCard();
        } else {
          this.updateStatusAndListCards(playerside + ' picks headline card first');
        }
        return 0;
      }

      // second player receives first card and sends card
      if (stage == "headline2") {
        this.updateLog(this.game.state.man_in_earth_orbit.toUpperCase() + " selecting headline card second");
        
        if (this.game.player == second_picker) {
          this.game.state.headline_opponent_hash = hash;
          this.game.state.headline_opponent_xor = xor;
          this.game.state.headline_opponent_card = card;
          console.log("My opponent picked: "+ this.game.state.headline_opponent_card+", now I chooose.");
          this.addMove("resolve\theadline");
          this.playerPickHeadlineCard();
        } else {
          this.updateStatusAndListCards(`${this.game.state.man_in_earth_orbit.toUpperCase()} picking headline card second`);
        }
        return 0;

      }

      // first player gets second player pick, then we move on....
      if (stage == "headline3") {
        if (this.game.player == first_picker) {
          this.game.state.headline_opponent_hash = hash;
          this.game.state.headline_opponent_xor = xor;
          this.game.state.headline_opponent_card = card;
          console.log("My opponent picked: "+ this.game.state.headline_opponent_card+", now we reveal.");
        }
        stage = "headline6"; //Fast forward to processing events
      }
    }

    /*
     * Process Headline cards 
     */


    //Sort cards by country
    let my_card = this.game.state.headline_card;
    let opponent_card = this.game.state.headline_opponent_card;

    let uscard, ussrcard;
    if (this.game.player == 1) {
      uscard = opponent_card;
      ussrcard = my_card;
    }else{
      ussrcard = opponent_card;
      uscard = my_card;
    }
      

    if (stage == "headline6") {

      this.updateLog("Moving into first headline card event");
      
      //Only calculate once
      this.game.state.player_to_go = 2; //default to us (in ties) and update below

      if (this.returnOpsOfCard(ussrcard) > this.returnOpsOfCard(uscard)) {
        this.game.state.player_to_go = 1;
      }

      let card_player = (this.game.state.player_to_go == 2)? "us": "ussr";

      console.log(`${card_player} goes first. I am ${this.game.player} and my card is ${my_card}`);

      //
      // check to see if defectors is in play
      //
     
      if (uscard == "defectors") {
     
        this.game.turn = []; 
        this.updateLog(`USSR headlines ${this.cardToText(ussrcard)}`);
        this.updateLog(`US headlines ${this.cardToText("defectors")} and cancels USSR headline.`);
        
        //
        // only one player should trigger next round
        if (this.game.player == 1) {
          this.addMove("resolve\theadline");
          this.addMove("discard\tus\tdefectors");
          this.addMove("discard\tussr\t"+my_card);
          this.endTurn();
        }
        this.updateStatus(`<div class='status-message' id='status-message'>${this.cardToText("defectors")} cancels USSR headline. Moving into first turn...</div>`);

      } else {
        let statusMsg = "";
        if (this.game.state.player_to_go == 1){
          statusMsg = `<div class='status-message' id='status-message'>USSR headlines ${this.cardToText(ussrcard)}. US headlines ${this.cardToText(uscard)}</div>`;
 
          this.updateLog(`USSR headlines ${this.cardToText(ussrcard)}.`);
          this.updateLog(`US headlines ${this.cardToText(uscard)}`);
        }else{
          statusMsg = `<div class='status-message' id='status-message'>US headlines ${this.cardToText(uscard)}. USSR headlines ${this.cardToText(ussrcard)}</div>`;
          this.updateLog(`US headlines ${this.cardToText(uscard)}.`);
          this.updateLog(`USSR headlines ${this.cardToText(ussrcard)}`);
        }

        if (this.game.state.player_to_go == this.game.player) {
          this.addMove("resolve\theadline");
          this.addMove("headline\theadline7\t"+this.game.state.player_to_go);
          this.addMove("event\t"+card_player+"\t"+my_card);
          this.removeCardFromHand(my_card);
          this.endTurn();
        }
        this.updateStatus(statusMsg);  
      }
      return 0;
    }

    //
    // second player plays headline card
    //
    if (stage == "headline7") {

      //You don't have to recalculate if we store the first player_to_go in game.state
      this.game.state.player_to_go = 3 - this.game.state.player_to_go; //Other pleyer goes now

      let card_player = (this.game.state.player_to_go == 2)? "us" : "ussr";
      let statusMsg = "";
      if (this.game.state.player_to_go == 1){
        statusMsg = `<div class='status-message' id='status-message'>Resolving USSR headline: ${this.cardToText(ussrcard)}</div>`;
      } else {
        statusMsg = `<div class='status-message' id='status-message'>Resolving US headline: ${this.cardToText(uscard)}</div>`;
      }
      
      if (this.game.state.player_to_go == this.game.player) {
        this.addMove("resolve\theadline");
        this.addMove("clear\theadline");
        this.addMove("event\t"+card_player+"\t"+my_card);
        this.removeCardFromHand(my_card);
        this.endTurn();
      }
      this.updateStatus(statusMsg);
      return 0;
    }

    return 1;

  }



  playerPickHeadlineCard() {

    this.startClock();

    let twilight_self = this;
    if (this.browser_active == 0) { return; }

    let player = (this.game.player == 1)? "ussr": "us";
    let x = "";

    //
    // HEADLINE PEEKING / man in earth orbit
    if (this.game.state.man_in_earth_orbit) {
      if (this.game.state.man_in_earth_orbit === player) {
        x = `${player.toUpperCase()} pick your headline card second (opponent selected: ${twilight_self.cardToText(twilight_self.game.state.headline_opponent_card)})`;
      } else {
        x = `${player.toUpperCase()} pick your headline card first`;
      }
    //
    // NORMAL HEADLINE ORDER
    } else {
      x = `${player.toUpperCase()} pick your headline card`;
    }

    this.updateStatusAndListCards(x,this.game.deck[0].hand);

    if (twilight_self.confirm_moves == 1) { twilight_self.cardbox.skip_card_prompt = 0; }
    twilight_self.attachCardboxEvents(function(card) {
      if (twilight_self.confirm_moves == 1) { twilight_self.cardbox.skip_card_prompt = 1; } //You want to skip confirmations after Headline???
      twilight_self.playerTurnHeadlineSelected(card, player);
    });

  }


playerTurnHeadlineSelected(card, player) {

    let twilight_self = this;

    // cannot pick china card or UN intervention
    if (card == "china") {
      this.displayModal("Invalid Headline", "You cannot headline China"); 
      return;
    }
    if (card == "unintervention") {
      this.displayModal("Invalid Headline", "You cannot headline UN Intervention"); 
      return;
    }

    twilight_self.game.state.headline_card = card;
    twilight_self.game.state.headline_xor = twilight_self.app.crypto.hash(Math.random().toString());
    twilight_self.game.state.headline_hash = twilight_self.app.crypto.encodeXOR(twilight_self.app.crypto.stringToHex(twilight_self.game.state.headline_card), twilight_self.game.state.headline_xor);


    //
    // HEADLINE PEEKING / man in earth orbit
    //
    if (this.game.state.man_in_earth_orbit){
      if (this.game.state.man_in_earth_orbit === player) {
        //Second pick
        twilight_self.addMove("headline\theadline3\t"+twilight_self.game.state.headline_hash+"\t"+twilight_self.game.state.headline_xor+"\t"+twilight_self.game.state.headline_card);      
      }else{ 
        //First pick
        twilight_self.addMove("headline\theadline2\t"+twilight_self.game.state.headline_hash+"\t"+twilight_self.game.state.headline_xor+"\t"+twilight_self.game.state.headline_card);
      } 
    }else { // NORMAL HEADLINE ORDER
    
      let hash1 = twilight_self.app.crypto.hash(card);    // my card
      let hash2 = twilight_self.app.crypto.hash(Math.random().toString());  // my secret
      let hash3 = twilight_self.app.crypto.hash(hash2 + hash1);             // combined hash

      let card_sig = twilight_self.app.crypto.signMessage(card, twilight_self.app.wallet.returnPrivateKey());
      let hash2_sig = twilight_self.app.crypto.signMessage(hash2, twilight_self.app.wallet.returnPrivateKey());
      let hash3_sig = twilight_self.app.crypto.signMessage(hash3, twilight_self.app.wallet.returnPrivateKey());

      twilight_self.game.spick_card = card;
      twilight_self.game.spick_hash = hash2;
      twilight_self.game.spick_done = 0;
      
      twilight_self.addMove("SIMULTANEOUS_PICK\t"+twilight_self.game.player+"\t"+hash3+"\t"+hash3_sig);
     
    }


    twilight_self.game.turn = [];
    $('.card').off();
    twilight_self.hideCard();
    twilight_self.endTurn();
    twilight_self.updateStatus("<div class='status-message' id='status-message'>simultaneous blind pick... encrypting selected card</div>");

    return;

  }




  playMove() {

    //
    // this is never run in headline - we set the headline to 0 here automatically
    // to avoid DEFCON error that can happen with NORAD if this is not done.
    //
    this.game.state.headline = 0;

    //
    // how many turns left?
    let rounds_in_turn = (this.game.state.round > 3)? 7: 6;
    let moves_remaining = rounds_in_turn - this.game.state.turn_in_round;

    //
    let scoring_cards_available = 0;
    for (i = 0; i < this.game.deck[0].hand.length; i++) {
      if (this.game.deck[0].cards[this.game.deck[0].hand[i]]?.scoring == 1) {
          scoring_cards_available++;
      }
    }

    //
    // player 1 (USSR) moves
    //
    if (this.game.state.turn == 1) {
      
      if (this.game.state.turn_in_round == 0) {
          this.game.state.turn_in_round++;
          this.updateActionRound();
      }

      if (this.game.player == 1) {
        if (this.game.state.events.missile_envy == 1) {
          //
          // if must play scoring card -- moves remaining at 0 in last move
          //
          if (scoring_cards_available > moves_remaining) {
            this.playerTurn("scoringcard");
          } else {
            //
            // if cannot sacrifice missile envy to bear trap because red purged
            //
            if (this.game.state.events.beartrap == 1 && this.game.state.events.redscare_player1 >= 1) {
              this.playerTurn();
            } else {
              this.playerTurn("missileenvy");
            }
          }
        } else {
          this.playerTurn();
        }
      } else {
        this.updateStatusAndListCards(`Waiting for USSR to move`);
        this.attachCardboxEvents();
      }
      return;
    }

    //
    // player 2 moves
    //
    if (this.game.state.turn == 2) {
      //
      // END OF HISTORY
      //
      if (this.game.state.events.greatsociety == 1) {
        this.game.state.events.greatsociety = 0;
        if (this.game.player == 2) {
          let scoring_cards = [];
          for (let i = 0; i < this.game.deck[0].hand.length; i++) {
            if (this.game.deck[0].cards[this.game.deck[0].hand[i]]?.scoring == 1) {
              scoring_cards.push(this.game.deck[0].hand[i]);
            }
          }

          let user_message = `Great Society is active. US may earn a VP for either skipping its turn or playing a scoring card:`;
          let html = "<ul>";
          if (scoring_cards.length > 0) {
            html += `<li class='card' id='scoring'>play scoring card</li>
                   <li class='card' id='scoring_w_card'>play scoring card and draw card</li>`;
          }
          html += `<li class='card' id='skip'>skip turn</li>
                <li class='card' id='skip_w_card'>skip turn and draw card</li>`;
          if (this.game.deck[0].hand.length > 0) {
            html += `<li class='card' id='select'>select card</li>`;
          }
          html += "</ul>";

          this.updateStatusWithOptions(user_message, html, false);

          let twilight_self = this;

          twilight_self.attachCardboxEvents(function (action2) {
            if (action2 === "select") {
              twilight_self.updateStatus();
              twilight_self.playerTurn();
              return;
            }
            if (action2 === "skip" || action2 === "skip_w_card") {
              twilight_self.addMove("resolve\tplay");
              if (action2 === "skip_w_card") {
                twilight_self.addMove("SAFEDEAL\t1\t2\t1");
                twilight_self.addMove("NOTIFY\tUS is drawing a bonus card");
              }
              twilight_self.addMove("vp\tus\t1\t0");
              twilight_self.addMove("NOTIFY\tUS skips a turn for 1 VP as a Great Society");
              twilight_self.endTurn();
            }
            if (action2 === "scoring" || action2 === "scoring_w_card") {
              twilight_self.addMove("resolve\tplay");
              twilight_self.addMove("vp\tus\t1\t0");
              twilight_self.addMove("NOTIFY\tUS plays a scoring card for 1 VP as a Great Society");
              if (action2 === "scoring_w_card") {
                twilight_self.addMove("SAFEDEAL\t1\t2\t1");
                twilight_self.addMove("NOTIFY\tUS is drawing a bonus card");
              }
              twilight_self.playerTurn("greatsociety");
            }
          });

          return 0;
        }
      }

      if (this.game.player == 2) {
    
        if (this.game.state.events.missile_envy == 2) {
          //
          // moves remaining will be 0 last turn
          //
          if (scoring_cards_available > moves_remaining) {
            this.playerTurn("scoringcard");
          } else {
            //
            // if cannot sacrifice missile envy to quagmire because red scare
            //
            if (this.game.state.events.quagmire == 1 && this.game.state.events.redscare_player2 >= 1) {
              this.playerTurn();
            } else {
              this.playerTurn("missileenvy");
            }
          }
        } else {
          this.playerTurn();
        }
      } else {
        this.updateStatusAndListCards(`Waiting for US to move`);
        this.attachCardboxEvents();
      }
      return;
    }

  }



  playerTurn(selected_card=null) {

    if (this.browser_active == 0) { return; }

    this.startClock();

    let twilight_self = this;

    //
    // if the clock is going, ask to confirm moves
    //
    //twilight_self.confirm_this_move = 1;

    //
    // END OF HISTORY
    //
    let greatsociety = 0;
    if (selected_card == "greatsociety") {
      greatsociety = 1;
      selected_card = "scoringcard";
    }

    //
    // remove back button from forced gameplay
    //
    if (selected_card != null) { 
      this.game.state.back_button_cancelled = 1; 
    }

    //
    // check who has China Card
    //
    //this.displayChinaCard();

    //
    // show active events
    //
    this.updateEventTiles();

    //
    // if player only has the China Card, they are allowed to skip
    // global var [is_player_skipping_playing_china_card] initialized to 0
    //
    if (selected_card == null) {
      if (this.game.deck[0].hand.length == 1) {
         if (this.game.deck[0].hand[0] == "china") {

          if (is_player_skipping_playing_china_card){ 
            //Keep passing automatically until end of round
            twilight_self.addMove("resolve\tplay");
            twilight_self.endTurn();
            return;
          }else{
            //Give player option to keep China card until next round

            let user_message = `You only have the ${this.cardToText("china")} card remaining. Do you wish to play it this turn?`;
            let html = '<ul><li class="card" id="play">play card</li><li class="card" id="skipturn">skip turn</li></ul>';
            this.updateStatusWithOptions(user_message, html,false);
            this.attachCardboxEvents(function(action) {
              if (action === "play") {
                twilight_self.playerTurn("china"); //reload function, ignoring this logic tree
              }
              if (action === "skipturn") {
                is_player_skipping_playing_china_card = 1;
                twilight_self.addMove("resolve\tplay");
                if (twilight_self.game.player == 1) {
                  twilight_self.addMove("NOTIFY\tUSSR chooses not to play the China Card");
                } else {
                  twilight_self.addMove("NOTIFY\tUS chooses not to play the China Card");
                }
                twilight_self.endTurn();
              }
            });

            return;
          }
          
         }
       }
    }


    original_selected_card = selected_card;

    //
    // reset region bonuses (if applicable)
    //
    this.game.state.events.china_card_in_play = 0;
    this.game.state.events.vietnam_revolts_eligible = 1;
    this.game.state.events.china_card_eligible = 1;
    this.game.state.events.region_bonus = "";
    this.game.state.ironlady_before_ops = 0;

    let player = "ussr";
    let opponent = "us";
    let playable_cards = [];

    if (this.game.player == 2) {
      player = "us";
      opponent = "ussr"; 
    }

    is_this_missile_envy_noneventable = this.game.state.events.missileenvy;

    if ( (player === "ussr" && this.game.state.events.missile_envy == 1) || (player === "us" && this.game.state.events.missile_envy == 2)) {
      is_this_missile_envy_noneventable = 1;
    }

    let user_message = "";

    /* Open play, choose a card from card list*/
    if (selected_card == null) {
      user_message = player.toUpperCase() + " pick a card: ";
      for (i = 0; i < this.game.deck[0].hand.length; i++) {

        // when UN Intervention is eventing, we can only select opponent cards
        if (this.game.state.events.unintervention == 1) {
          if (this.game.deck[0].cards[this.game.deck[0].hand[i]].player === opponent) {
            playable_cards.push(this.game.deck[0].hand[i]);
          }
        } else {
          playable_cards.push(this.game.deck[0].hand[i]);
        }
      };
    } else {

      /*Function called with a particular card in mind*/
      if (selected_card === "scoringcard") {
        user_message = 'Scoring card must be played: <ul>';
        for (i = 0; i < this.game.deck[0].hand.length; i++) {  
          if (this.game.deck[0].cards[this.game.deck[0].hand[i]]?.scoring == 1) {
            selected_card = this.game.deck[0].hand[i];
            playable_cards.push(this.game.deck[0].hand[i]);
          }
        }
      } else {
        playable_cards.push(selected_card);
      }
    }


    //
    // Add dummy card for canceling Cuban Missile Crisis
    if (this.game.player == this.game.state.events.cubanmissilecrisis && this.game.player > 0) {
      if (this.canCancelCMC()) {
        playable_cards.push("cancel cuban missile crisis");
      }
    }

    //
    // Bear Trap and Quagmire
    //
    // headline check ensures that Quagmire does not trigger if headlined and the US triggers a card pull
    //
    if (this.game.state.headline == 0 && ((this.game.player == 1 && this.game.state.events.beartrap == 1) || (this.game.player == 2 && this.game.state.events.quagmire == 1)) ) {

      //
      // do we have cards to select
      //
      let cards_available = 0;
      let scoring_cards_available = 0;
      playable_cards = [];

      //
      // how many turns left?
      //
      let rounds_in_turn = 6;
      if (this.game.state.round > 3) { rounds_in_turn = 7; }
      let moves_remaining = rounds_in_turn - this.game.state.turn_in_round;

      user_message = `Select a card for ${(this.game.player == 1)? "Bear Trap": "Quagmire"}: `;

      for (i = 0; i < this.game.deck[0].hand.length; i++) {
        if (this.modifyOps(this.game.deck[0].cards[this.game.deck[0].hand[i]].ops, this.game.deck[0].hand[i], player, 0) >= 2 && this.game.deck[0].hand[i] != "china") {
          playable_cards.push(this.game.deck[0].hand[i]);
          cards_available++;
        }
        
        if (this.game.deck[0].cards[this.game.deck[0].hand[i]]?.scoring == 1) { 
          scoring_cards_available++; 
        }
      }

      //
      // handle missile envy if needed
      let playable_cards_handled = 1;
      if (this.game.state.events.missile_envy == this.game.player) {
        playable_cards_handled = 0;
        if (this.modifyOps(2, "missileenvy", player, 0) >= 2) {
          // reset here, since will not trigger elsewhere
          playable_cards_handled = 1;
          this.game.state.events.missile_envy = 0;
          this.game.state.events.missileenvy = 0;
          playable_cards = [];
          playable_cards.push("missileenvy");
        }
      }

      if (scoring_cards_available >= moves_remaining) {
        playable_cards_handled = 0;
      } else {
        if (cards_available == 0) { 
          playable_cards_handled = 0;
        }
      }

      if (playable_cards_handled == 0) {

        //
        // do we have any cards to play?
        //
        if (cards_available > 0 && scoring_cards_available <= moves_remaining) {
          //this.updateStatus("<div class='status-message' id='status-message'>" + user_message + '</div>');
          playable_cards = [];
          for (i = 0; i < this.game.deck[0].hand.length; i++) {
            if (this.game.deck[0].cards[this.game.deck[0].hand[i]] != undefined) {
              if (this.modifyOps(this.game.deck[0].cards[this.game.deck[0].hand[i]].ops, this.game.deck[0].hand[i], player, 0) >= 2 && this.game.deck[0].hand[i] != "china") {
                playable_cards.push(this.game.deck[0].hand[i]);
              }
            }
          }
        } else {
          if (scoring_cards_available > 0) {
            if (this.game.player == 1) {
              user_message = "Bear Trap restricts you to Scoring Cards: ";
            } else {
              user_message = "Quagmire restricts you to Scoring Cards: ";
            }
            playable_cards = [];
            for (i = 0; i < this.game.deck[0].hand.length; i++) {
              if (this.game.deck[0].cards[this.game.deck[0].hand[i]]?.scoring == 1) {
                playable_cards.push(this.game.deck[0].hand[i]);
              }
            }
          } else {
            if (this.game.state.events.beartrap == 1) {
              user_message = "No cards playable due to Bear Trap: ";
            } else {
              user_message = "No cards playable due to Quagmire: ";
            }
            playable_cards = [];
            playable_cards.push("skipturn");
          }
        }
      }
    }

    //
    // display the cards -- probably a problem here in defaulting back to hand
    //
    if (playable_cards.length > 0) {
      this.updateStatusAndListCards(user_message, playable_cards);
    } else {
      this.updateStatusAndListCards(user_message, this.game.deck[0].hand);
    }


    if (this.game.state.events.unintervention != 1 && selected_card != "grainsales") {

      //
      // END OF HISTORY
      //
      // note - do not remove the clearing of the moves array if removing greatsociety
      //
      if (greatsociety != 1) {
        this.moves = [];
      }

    }

    twilight_self.playerFinishedPlacingInfluence();


    //
    // cannot play if no cards remain
    //
    if (selected_card == null && this.game.deck[0].hand.length == 0) {
      this.addMove("resolve\tplay");
      this.addMove(`NOTIFY\t${player.toUpperCase()} skipping turn... no cards left to play`);
      this.endTurn();
      this.updateStatus("<div class='status-message' id='status-message'>Skipping turn... no cards left to play</div>");
      return;
    }

    twilight_self.attachCardboxEvents(function(card) {
      twilight_self.playerTurnCardSelected(card, player);
    });

  }



  async playerTurnCardSelected(card, player) {

    this.startClock();

    let twilight_self = this;
    let opponent = "us";
    if (this.game.player == 2) { opponent = "ussr"; }

      //
      // Skip Turn
      //
      if (card === "skipturn") {
        twilight_self.hideCard();
        twilight_self.addMove("resolve\tplay");
        twilight_self.addMove("NOTIFY\t"+player.toUpperCase()+" has no cards playable.");
        twilight_self.endTurn();
        return 0;
      }


      //
      // warn if user is leaving a scoring card in hand
      //
      let scoring_cards_available = 0;
      let rounds_in_turn = 6;
      if (twilight_self.game.state.round > 3) { rounds_in_turn = 7; }
      let moves_remaining = rounds_in_turn - twilight_self.game.state.turn_in_round;

      for (i = 0; i < twilight_self.game.deck[0].hand.length; i++) {
        if (twilight_self.game.deck[0].cards[twilight_self.game.deck[0].hand[i]]?.scoring == 1) { 
          scoring_cards_available++; 
        }
      }


      if (scoring_cards_available > 0 && scoring_cards_available > moves_remaining && twilight_self.game.deck[0].cards[card]?.scoring == 0) {
        let c = await sconfirm("Holding a scoring card at the end of the turn will lose you the game. Still play this card?");
        if (c) {} else { return; }
      }


      twilight_self.hideCard(); //close cardbox in case it is open

      //
      // WWBY 
      //
      if (twilight_self.game.state.events.wwby == 1 && twilight_self.game.state.headline == 0) {
        if (player == "us") {
          if (card != "unintervention") {
            twilight_self.game.state.events.wwby_triggers = 1; //Remember penalty to apply with next endturn
          }
          twilight_self.game.state.events.wwby = 0; //Turn off WWBY
        }
      }

      //
      // Quagmire / Bear Trap
      //
      if (twilight_self.game.state.headline == 0 && ((twilight_self.game.state.events.quagmire == 1 && twilight_self.game.player == 2) || (twilight_self.game.state.events.beartrap == 1 && twilight_self.game.player == 1)) ) {
        //
        // scoring cards score, not get discarded
        if (twilight_self.game.deck[0].cards[card]?.scoring == 0) {
          twilight_self.removeCardFromHand(card);
          twilight_self.addMove("resolve\tplay");
          twilight_self.addMove("quagmire\t"+player+"\t"+card);
          twilight_self.addMove("discard\t"+player+"\t"+card);
          twilight_self.endTurn();
          return 0;
        }
      }

      //
      // Cuban Missile Crisis
      if (card === "cancel cuban missile crisis") {
        twilight_self.cancelCubanMissileCrisis();
        return 0;
      }


      //Process the card
      twilight_self.addMove("resolve\tplay");
      twilight_self.addMove("discard\t"+player+"\t"+card);

      //Go straight to ops when pairing with UN Intervention
      if (twilight_self.game.state.events.unintervention === 1){
        // resolve added
        //twilight_self.addMove("NOTIFY\t"+player.toUpperCase()+" plays "+card+" with UN Intervention");
        twilight_self.addMove("ops\t"+player+"\t"+card+"\t"+twilight_self.game.deck[0].cards[card].ops);
        twilight_self.removeCardFromHand(card);
        twilight_self.endTurn();
        return;

      }

      //
      // The China Card
      //
      if (card == "china") {
        twilight_self.addMove("unlimit\tchina");
        twilight_self.game.state.events.china_card_in_play = 1;
      }


      if (twilight_self.game.deck[0].cards[card]?.scoring == 1) {
        let status_header = `Playing ${twilight_self.game.deck[0].cards[card].name}:`;
        let html = `<ul><li class="card" id="event">score region</li></ul>`;

        // true means we want to include the back button in our functionality
        /*if (this.game.state.back_button_cancelled == 1) {
          html = twilight_self.formatStatusHeader(status_header, html, false);
        } else {
          html = twilight_self.formatStatusHeader(status_header, html, true);
        }*/
        twilight_self.updateStatusWithOptions(status_header, html, (this.game.state.back_button_cancelled != 1));
      } else {

        let ops = twilight_self.modifyOps(twilight_self.game.deck[0].cards[card].ops, card, player, 0);


    
        let announcement = "";

        announcement += `<ul>`;

        //
        // cannot play China card or Missile Envy (forced) for event
        // cannot event UN Intervention w/o the opponent card in hand
        //
        let can_play_event = 1;
        if (card == "unintervention") {
          let opponent_event_in_hand = 0;
          for (let b = 0; b < twilight_self.game.deck[0].hand.length; b++) {
            let tmpc = twilight_self.game.deck[0].hand[b];
            if (tmpc != "china") {
              if (twilight_self.game.player == 1) {
                if (twilight_self.game.deck[0].cards[tmpc].player === "us") { opponent_event_in_hand = 1; }
              } else {
                if (twilight_self.game.deck[0].cards[tmpc].player === "ussr") { opponent_event_in_hand = 1; }
              }
            }
          }
          if (opponent_event_in_hand == 0) { can_play_event = 0; }
        }
        if (card == "china") { can_play_event = 0; }
        if (card == "missileenvy" && is_this_missile_envy_noneventable == 1) { can_play_event = 0; }

        //
        // cannot play event of opponent card (usability fix)
        //
        if (twilight_self.game.deck[0].cards[card].player == opponent) { can_play_event = 0; }

        //
        // cancel cuban missile crisis
        //
        if (twilight_self.game.state.events.cubanmissilecrisis && twilight_self.game.state.events.cubanmissilecrisis === twilight_self.game.player){
          if (twilight_self.canCancelCMC()) {
            announcement += '<li class="card" id="cancel_cmc">cancel cuban missile crisis</li>';
          }
        }

        if (can_play_event == 1) { announcement += '<li class="card" id="event">play event</li>'; }

        announcement += '<li class="card" id="ops">play ops</li>';

        announcement += twilight_self.isSpaceRaceAvailable(ops);    

        let header_msg = `${player.toUpperCase()} playing <span>${twilight_self.game.deck[0].cards[card].name}</span>`; 
        /*if (twilight_self.game.state.back_button_cancelled == 1) {
          announcement = twilight_self.formatStatusHeader(header_msg, announcement,false);
        } else {
          announcement = twilight_self.formatStatusHeader(header_msg, announcement, true);
        }*/

        twilight_self.updateStatusWithOptions(header_msg, announcement, (twilight_self.game.state.back_button_cancelled!=1));
      }

      twilight_self.bindBackButtonFunction(() => {
        this.playerTurn();
      });

      twilight_self.attachCardboxEvents(async function(action) {
        $('.card').off();

        //
        // missile envy (reset if held over headline)
        // - added August 15 2020
        //
        if ((twilight_self.game.player == 2 && twilight_self.game.state.events.missile_envy == 2) || (twilight_self.game.player == 1 && twilight_self.game.state.events.missile_envy == 1)) {
          if (card == "missileenvy") {
            twilight_self.game.state.events.missileenvy = 0;
            twilight_self.game.state.events.missile_envy = 0;
            is_this_missile_envy_noneventable = 0;
          }
        }


        //
        // Cuban Missile Crisis
        //
        if (action == "cancel_cmc") {
          twilight_self.moves = []; //Clear the resolve play so we go back to the same player's turn
          await twilight_self.cancelCubanMissileCrisis();
          twilight_self.playerTurnCardSelected(card, player); //And shortcut back to our position
          return;
        }


        if (action == "event") {

          //
          // sanity check on opponent event choice
          //
          if (twilight_self.game.deck[0].cards[card].player != "both" && twilight_self.game.deck[0].cards[card].player != player) {

            let fr_header =  "This is your opponent's event. Are you sure you wish to play it for the event instead of the OPS?";
            let fr_msg = '<ul><li class="card" id="playevent">play event</li></ul>';

            twilight_self.updateStatusWithOptions(fr_header,fr_msg,true);

            twilight_self.attachCardboxEvents(function(action) {
              $('.card').off();
              if (action == "playevent") {
                twilight_self.playerTriggerEvent(player, card);
                return;
              }
            });
            twilight_self.bindBackButtonFunction(()=>{twilight_self.playerTurn(original_selected_card)});
            return;
          }

          //
          // our event or both
          //
          if (twilight_self.confirm_moves == 1) {

            let fr_header = `Confirm you want to play this event: `;
            let fr_msg = `
              <ul><li class="card" id="playevent">play event</li>
              <li><input type="checkbox" name="dontshowme" value="true" style="width: 20px;height: 1.5em;"/> don't ask again (expert mode)...</li>
              <ul>`;

             twilight_self.updateStatusWithOptions(fr_header,fr_msg,true);
            twilight_self.attachCardboxEvents(function(action) {
              $('.card').off();
              if (action == "playevent") {
                twilight_self.playerTriggerEvent(player, card);
                return;
              }
            });

            $('input:checkbox').change(function() {
              if ($(this).is(':checked')) {
                twilight_self.confirm_moves = 0;
                twilight_self.saveGamePreference('confirm_moves', 1);
              try { $(".game-confirm").text("Newbie Mode"); } catch (err) {}
              }
            });

            twilight_self.bindBackButtonFunction(()=>{twilight_self.playerTurn(original_selected_card)});
            return;
          }

          // play normally when not confirmed
          twilight_self.playerTriggerEvent(player, card);
          return;

        }

        if (action == "ops") {

          //
          // our event or both
          if (twilight_self.confirm_moves == 1 && (card != "missileenvy" || is_this_missile_envy_noneventable == 0)) {

            let fr_header = "Confirm you want to play for ops:";
            let fr_msg = `<ul>
              <li class="card" id="playevent">play for ops</li>
              <li><input type="checkbox" name="dontshowme" value="true" style="width: 20px;height: 1.5em;"/> don't ask again (expert mode)...</li>
              </ul>
              `;
          
             twilight_self.updateStatusWithOptions(fr_header, fr_msg, true);

             twilight_self.attachCardboxEvents(function(action) {
              $('.card').off();

              if (action == "playevent") {
                twilight_self.playerTriggerOps(player, card);
                return;
              }
             });

            $('input:checkbox').change(function() {
              if ($(this).is(':checked')) {
                twilight_self.confirm_moves = 0;
                twilight_self.saveGamePreference('confirm_moves', 0);
              try { $(".game-confirm").text("Newbie Mode"); } catch (err) {}
              }
            });

            twilight_self.bindBackButtonFunction(()=>{twilight_self.playerTurn(original_selected_card)});
            return;
          }

          // play normally when not confirmed
          twilight_self.playerTriggerOps(player, card);
          return;

        }

        if (action == "space") {

          if (twilight_self.confirm_moves == 1) {
            let fr_header = `Confirm you want to space ${twilight_self.game.deck[0].cards[card].name}`;
            let fr_msg =  `<ul><li class="card" id="spaceit">send into orbit</li>
              <li><input type="checkbox" name="dontshowme" value="true" style="width: 20px;height: 1.5em;"/> don't ask again (expert mode)...</li>
              </ul>`;

            twilight_self.updateStatusWithOptions(fr_header,fr_msg,true);
            twilight_self.attachCardboxEvents(function(action) {
              $('.card').off();

              if (action == "spaceit") {
                twilight_self.addMove("space\t"+player+"\t"+card);
                twilight_self.removeCardFromHand(card);
                twilight_self.endTurn();
                return;
              }
            });

            $('input:checkbox').change(function() {
              if ($(this).is(':checked')) {
                twilight_self.confirm_moves = 0;
                twilight_self.saveGamePreference('confirm_moves', 1);
                try { $(".game-confirm").text("Newbie Mode"); } catch (err) {}
              }
            });

            twilight_self.bindBackButtonFunction(()=>{twilight_self.playerTurn(original_selected_card)});
            return;
          }

          twilight_self.addMove("space\t"+player+"\t"+card);
          twilight_self.removeCardFromHand(card);
          twilight_self.endTurn();
          return;
        }

        twilight_self.updateStatus("");

      });

  }




  playOps(player, ops, card) {

    if (this.game.player == 0) { return; }

    let original_ops = ops;
    let twilight_self = this;
    
    //
    // modify ops
    ops = this.modifyOps(ops, card, player);

    let me = "ussr";
    if (this.game.player == 2) { me = "us"; }

    // reset events / DOM
    twilight_self.playerFinishedPlacingInfluence();
 
    if (player === me) {

      let bind_back_button_state = true;
      if (twilight_self.game.state.event_before_ops == 1) { bind_back_button_state = false; }
      if (twilight_self.game.state.headline == 1) { bind_back_button_state = false; }
      if (twilight_self.game.state.back_button_cancelled == 1) { bind_back_button_state = false; }

      let html = twilight_self.formatPlayOpsStatus(player, ops); 
      
      twilight_self.updateStatusWithOptions(`${player.toUpperCase()} plays ${ops} OPS:`, html, bind_back_button_state);

      if (bind_back_button_state) {
        twilight_self.bindBackButtonFunction(() => {
          twilight_self.game.state.events.vietnam_revolts_eligible = 1;
          twilight_self.game.state.events.china_card_eligible = 1;
          twilight_self.addMove("revert");
          twilight_self.endTurn();
  	      return;
        });
      }

      // TODO:
      twilight_self.attachCardboxEvents(async function(action2) {

        //
        // prevent ops hang
        //
        twilight_self.addMove("resolve\tops");

        if (action2 == "cancel_cmc") {
          this.moves = [];

          let are_we_playing_ops = 0;
          if (twilight_self.game.queue[twilight_self.game.queue.length-1].split("\t")[0] === "ops") {
            are_we_playing_ops = 1;
          }

          if (are_we_playing_ops == 0) {
              twilight_self.addMove(`ops\t${me}\t${card}\t${original_ops}`);
          }

          twilight_self.cancelCubanMissileCrisis();

          return;
        }

        if (action2 == "space"){
          if (twilight_self.confirm_moves == 1) {
              let fr_header = `Confirm you want to space ${twilight_self.game.deck[0].cards[card].name}`;
              let fr_msg =  `<ul><li class="card" id="spaceit">send into orbit</li>
                <li><input type="checkbox" name="dontshowme" value="true" style="width: 20px;height: 1.5em;"/> don't ask again (expert mode)...</li>
                </ul>`;

              twilight_self.updateStatusWithOptions(fr_header,fr_msg,true);
              twilight_self.attachCardboxEvents(function(action) {
                $('.card').off();

                if (action == "spaceit") {
                  twilight_self.addMove("space\t"+player+"\t"+card);
                  twilight_self.removeCardFromHand(card);
                  twilight_self.endTurn();
                  return;
                }
              });

              $('input:checkbox').change(function() {
                if ($(this).is(':checked')) {
                  twilight_self.confirm_moves = 0;
                  twilight_self.saveGamePreference('confirm_moves', 1);
                  try { $(".game-confirm").text("Newbie Mode"); } catch (err) {}
                }
              });

              twilight_self.bindBackButtonFunction(()=>{twilight_self.playerOps(player, ops, card)});
              return;
            }

            twilight_self.addMove("space\t"+player+"\t"+card);
            twilight_self.removeCardFromHand(card);
            twilight_self.endTurn();
            return;

        }

        if (action2 == "place") {

          let j = ops;
          let html = twilight_self.formatStatusHeader("Place " + j + " influence", true)
          twilight_self.updateStatus(html);
          twilight_self.prePlayerPlaceInfluence(player);
          if (j == 1) {
            twilight_self.uneventOpponentControlledCountries(player, card);
          }

          twilight_self.playerPlaceInfluence(player, (country, player) => {

            j--;

            //
            // breaking control must be costly
            //
            if (twilight_self.game.break_control == 1) {
              j--;
              if (j < 0) { twilight_self.endRegionBonus(); j = 0; }
            }
            twilight_self.game.break_control = 0;

            if (j < 2) {
              twilight_self.uneventOpponentControlledCountries(player, card);
            }

            let html = twilight_self.formatStatusHeader("Place " + j + " influence", true)
            twilight_self.updateStatus(html);

            if (j <= 0) {
              if (twilight_self.isRegionBonus(card) == 1) {
                j++;
                twilight_self.limitToRegionBonus();
                twilight_self.endRegionBonus();
              } else {
                twilight_self.playerFinishedPlacingInfluence();
                twilight_self.endTurn();
                return;
              }
            }


            twilight_self.bindBackButtonFunction(() => {
              //
              // If the placement array is full, then
              // undo all of the influence placed this turn
              //
              if (twilight_self.undoMove(action2, ops - j)) {

            		//
            		// reset china and vietnam revolts eligibility
            		//
            		twilight_self.game.state.events.vietnam_revolts_eligible = 1;
            		twilight_self.game.state.events.china_card_eligible = 1;

                twilight_self.playOps(player, ops, card);
              }
            });

          });

        }

        if (action2 == "coup") {

          //
          // sanity Cuban Missile Crisis check
          //
          if (twilight_self.game.state.events.cubanmissilecrisis == 2 && player =="us" ||
              twilight_self.game.state.events.cubanmissilecrisis == 1 && player =="ussr"
          ) {
            let c = await sconfirm("Are you sure you wish to coup during the Cuban Missile Crisis?"); 
            if (c) {
            } else {
              twilight_self.playOps(player, ops, card);
              return;
            }
          }

          let html = twilight_self.formatStatusHeader("Pick a country to coup", true);
          twilight_self.updateStatus(html);
          twilight_self.playerCoupCountry(player, ops, card);

        }


        if (action2 == "realign") {
          let alignment_rolls = ops;
          let header_msg = `Pick a target to realign (${alignment_rolls} rolls), or:`;
          let html = `<ul><li class="card" id="cancelrealign">end turn without rolling</li></ul>`;
          twilight_self.updateStatusWithOptions(header_msg,html,true);

          twilight_self.attachCardboxEvents(function(action2) {
            if (action2 == "cancelrealign") {
              twilight_self.addMove("NOTIFY\t"+player.toUpperCase()+" opts to end realignments");
              twilight_self.endTurn();
              return;
            }
          });


          ///////////////
          //playerRealign(player, card, mycallback=null) {

 
          $(".country").off();
          $(".country").on('click', async function() {
            
            let c = $(this).attr('id');

            let coupHeader = `Cannot Realign ${twilight_self.countries[c].name}`;
            let failureReason = ""; //Also tells us if it is a valid target

            //
            // Region Restrictions
            //
            if (twilight_self.game.state.limit_region.indexOf(twilight_self.countries[c].region) > -1) {
              failureReason = "Invalid Region for Realignment";
            }

            //
            // DEFCON restrictions
            //
            if (twilight_self.game.state.limit_ignoredefcon == 0 && twilight_self.game.state.events.inftreaty == 0) {
              if (twilight_self.countries[c].region == "europe" && twilight_self.game.state.defcon < 5) {
                failureReason = "DEFCON prevents realignments in Europe";
              }
              if (twilight_self.countries[c].region == "asia" && twilight_self.game.state.defcon < 4) {
                failureReason = "DEFCON prevents realignments in Asia";
              }
              if (twilight_self.countries[c].region == "seasia" && twilight_self.game.state.defcon < 4) {
                failureReason = "DEFCON prevents realignments in Asia";
              }
              if (twilight_self.countries[c].region == "mideast" && twilight_self.game.state.defcon < 3) {
                failureReason = "DEFCON prevents realignments in the Middle-East";
              }
            }

            /* Though DEFCON is sufficient reason to stop a coup, it may be more interesting to the player to fail in more specific ways, if possible*/

            if (twilight_self.game.state.events.usjapan == 1 && c == "japan" && player == "ussr") {
              failureReason = "US / Japan Alliance prevents realignments in Japan";
            }


            // Nato Coup Restriction
            if (twilight_self.countries[c].region == "europe" && twilight_self.game.state.events.nato == 1 && player == "ussr") {
              if (twilight_self.isControlled("us", c) == 1) {
                if ( (c == "westgermany" && twilight_self.game.state.events.nato_westgermany == 0) || (c == "france" && twilight_self.game.state.events.nato_france == 0) ) {
                  //If West Germany or France have been removed from Nato (by Degaulle or WillyBrandt), then one can coup there....
                } else {
                  failureReason = "NATO prevents realignments of US-controlled countries in Europe";
                }
              }
            }

            if ((player == "us" && twilight_self.countries[c].ussr <= 0) || (player == "ussr" && twilight_self.countries[c].us <= 0)) {
              failureReason = "No enemy influence";
            } 


            if (failureReason.length > 0) { 
            
              twilight_self.displayModal(coupHeader, failureReason);
            
            }else{ //No reason to fail, go ahead and launch coup   
              //
              // vietnam revolts and china card bonuses
              //
              if (twilight_self.countries[c].region !== "seasia") { twilight_self.game.state.events.vietnam_revolts_eligible = 0; }
              if (twilight_self.countries[c].region !== "seasia" && twilight_self.countries[c].region !== "asia") { twilight_self.game.state.events.china_card_eligible = 0; }
             
              //Play move / add move to queue
              var result = twilight_self.playRealign(player, c);
              twilight_self.addMove("realign\t"+player+"\t"+c);


              alignment_rolls--;

              //Update directions
              twilight_self.updateStatusWithOptions(`Pick a target to realign (${alignment_rolls} rolls), or:`,`<ul><li class="card" id="cancelrealign">end turn</li></ul>`,false);
              twilight_self.attachCardboxEvents(function(action2) {
                if (action2 == "cancelrealign") { //Not a cancel, keeps realignment rolls so far...
                  twilight_self.reverseMoves("realign");
                  return;
                }
              });

              if (alignment_rolls <= 0) {
                if (twilight_self.isRegionBonus(card) == 1) {
                  //twilight_self.updateStatus("<div class='status-message' id='status-message'>Realign with bonus OP</div>");
                  twilight_self.limitToRegionBonus(); //Turn off click events outside of regional bonus
                  twilight_self.endRegionBonus(); //Toggle flags about aplicability of regional bonuses
                  alignment_rolls++;
                } else {

                  twilight_self.reverseMoves("realign");             
                  return;
                }
              }

            }
          
          });

        }
            

        twilight_self.bindBackButtonFunction(() => {
          twilight_self.playOps(player, ops, card);
        });       


      });

    }else{
      this.updateStatusAndListCards(`${player.toUpperCase()} playing ${this.game.state.event_name} for ${ops} OPS`);
      this.attachCardboxEvents();
    }

    return;

  }

  reverseMoves(action){
    let new_moves = [];
    for (let z = this.moves.length-1; z >= 0; z--) {
      let tmpar = this.moves[z].split("\t");
      if (tmpar[0] === action) {
        new_moves.push(this.moves[z]);
      } else {
        new_moves.unshift(this.moves[z])
      }
    }
    this.moves = new_moves;
    this.endTurn();
  }

  async confirmEvent() {
    let c = await sconfirm("Confirm your desire to play this event");
    return c;
  }

  formatPlayOpsStatus(player, ops) {
    let html = '<ul>';

    if ((this.game.player == this.game.state.events.cubanmissilecrisis)  && this.game.state.events.cubanmissilecrisis > 0 ) {
      if (this.canCancelCMC()) {
        html += '<li class="card" id="cancel_cmc">cancel cuban missile crisis</li>';
      }
    }

    if (this.game.state.limit_placement == 0) { html += '<li class="card" id="place">place influence</li>'; }
    if (this.game.state.limit_coups == 0) { html += '<li class="card" id="coup">launch coup</li>'; }
    if (this.game.state.limit_realignments == 0) { html += '<li class="card" id="realign">realign country</li>'; }
    if (this.game.state.events.unintervention == 1) {html += this.isSpaceRaceAvailable(ops); }

    html += '</ul>';
    return html;
  }

  bindBackButtonFunction(mycallback) {
    $('#back_button').off();
    $('#back_button').on('click', mycallback);
  }


  canCancelCMC(){
    if (this.game.player == 1 && this.countries['cuba'].ussr >= 2) { return 1; }
    if (this.game.player == 2 && this.countries['turkey'].us >= 2) { return  1; }
    if (this.game.player == 2 && this.countries['westgermany'].us >= 2) { return  1; }
    return 0;
  }
  /*
  Apparently, we want to give the player ample opportunities to make this move
  */
  cancelCubanMissileCrisis(){
    let twilight_self = this;
  
    if (twilight_self.game.player == 1) {
      twilight_self.removeInfluence("cuba", 2, "ussr");
      twilight_self.addMove("remove\tussr\tussr\tcuba\t2");
      twilight_self.addMove("unlimit\tcmc");
      twilight_self.addMove("NOTIFY\tUSSR has cancelled the Cuban Missile Crisis");
      twilight_self.endTurn();
    } else {
      let html = "<ul>";
      if (twilight_self.countries['turkey'].us >= 2) {
        html += '<li class="card" id="turkey">Turkey</li>';
      }
      if (twilight_self.countries['westgermany'].us >= 2) {
        html += '<li class="card" id="westgermany">West Germany</li>';
      }
      html += '</ul>';
      twilight_self.updateStatusWithOptions('Select country from which to remove influence:',html,false);
      twilight_self.attachCardboxEvents(function(action2) {
    
        twilight_self.removeInfluence(action2, 2, "us");
        twilight_self.addMove(`remove\tus\tus\t${action2}\t2`);
        twilight_self.addMove("unlimit\tcmc");
        twilight_self.addMove("NOTIFY\tUS has cancelled the Cuban Missile Crisis");
        twilight_self.endTurn();
      });

    }
  }

  
  revertTurn() {
    let twilight_self = this;
    if (start_turn_game_state == null || start_turn_game_state == undefined) {} else {
      twilight_self.game.state = start_turn_game_state;
    }
    for (let i = twilight_self.game.queue.length-1; i >= 0; i--) {
      let tmpar = twilight_self.game.queue[i].split("\t");
      if (tmpar[0] === "discard") {
      	if (tmpar[1] === "ussr" && twilight_self.game.player == 1) {
	        if (tmpar[2] != "ops") {
            twilight_self.updateLog("USSR second-guesses themselves...");
	          twilight_self.addCardToHand(tmpar[2]);
	        }
	      }
      	if (tmpar[1] === "us" && twilight_self.game.player == 2) {
      	  if (tmpar[2] != "ops") {
                  twilight_self.updateLog("US second-guesses themselves...");
      	    twilight_self.addCardToHand(tmpar[2]);
      	  }
      	}
      }
      if (tmpar[0] === "play") {
        twilight_self.displayBoard();
	      return 1;
      } else {
	      twilight_self.game.queue.splice(i, 1);
      }
    }
    twilight_self.displayBoard();
  }




  


  playerTriggerOps(player, card) {

    let twilight_self = this;
    let opponent = "us";
    if (this.game.player == 2) { opponent = "ussr"; }

    //
    // Flower Power -- needs to be higher up the chain
    //
    if (twilight_self.game.state.events.flowerpower == 1 && player === "us") {
      if ((card == "arabisraeli" && twilight_self.game.state.events.campdavid == 0) || card == "koreanwar" || card == "brushwar" || card == "indopaki" || card == "iraniraq") {
        twilight_self.addMove("modal\t"+this.cardToText("flowerpower"),"USSR gains 2 VP");
        twilight_self.addMove("NOTIFY\tFlower Power triggered by "+this.cardToText(card));
        twilight_self.addMove("vp\tussr\t2\t1");
      }
    }


    if (twilight_self.game.deck[0].cards[card].player == opponent) {
        let html = '<ul><li class="card" id="before_ops">event before ops</li><li class="card" id="after_ops">event after ops</li></ul>';
        twilight_self.updateStatusWithOptions('Playing opponent card:', html, true);

        twilight_self.bindBackButtonFunction(() => {  twilight_self.playerTurnCardSelected(card, player);  });

        twilight_self.attachCardboxEvents(function(action2) {

          twilight_self.game.state.event_before_ops = 0;
          twilight_self.game.state.event_name = twilight_self.cardToText(card);

          if (action2 === "before_ops") {
            twilight_self.game.state.event_before_ops = 1;
            twilight_self.addMove("ops\t"+player+"\t"+card+"\t"+twilight_self.game.deck[0].cards[card].ops);
            twilight_self.addMove("event\t"+player+"\t"+card);
            
          }
          else if (action2 === "after_ops") {
            twilight_self.addMove("event\t"+player+"\t"+card);
            twilight_self.addMove("ops\t"+player+"\t"+card+"\t"+twilight_self.game.deck[0].cards[card].ops);
          }
          
          twilight_self.removeCardFromHand(card);
          twilight_self.endTurn();
          return;
        });
      

      return;

    } else { //Playing my own or neutral card for ops

      twilight_self.addMove("ops\t"+player+"\t"+card+"\t"+twilight_self.game.deck[0].cards[card].ops);
      if (card == "china") { twilight_self.addMove("limit\tchina"); }
      twilight_self.removeCardFromHand(card);
      twilight_self.endTurn();
      return;

    }

  }





  playerTriggerEvent(player, card) {

    let twilight_self = this;

    //
    // Flower Power
    //
    if (twilight_self.game.state.events.flowerpower == 1) {
      if ((card == "arabisraeli" && twilight_self.game.state.events.campdavid == 0) || card == "koreanwar" || card == "brushwar" || card == "indopaki" || card == "iraniraq") {
        if (player === "us") {
          twilight_self.addMove("modal\t"+this.cardToText("flowerpower"),"USSR gains 2 VP");
          twilight_self.addMove("NOTIFY\tFlower Power triggered by "+this.cardToText(card));
          twilight_self.addMove("vp\tussr\t2\t1");
        }
      }
    }

    twilight_self.game.state.event_name = twilight_self.cardToText(card);
    twilight_self.addMove("event\t"+player+"\t"+card);
    twilight_self.removeCardFromHand(card);


    //
    // Our Man in Tehran -- check if reshuffle is needed
    //
    if (card == "tehran") {

      //
      // reshuffle needed before event
      //
      if (5 > twilight_self.game.deck[0].crypt.length) {

        let discarded_cards = twilight_self.returnDiscardedCards();

      	//
      	// shuttle diplomacy
      	//
       	if (this.game.state.events.shuttlediplomacy == 1) {
      	  if (discarded_cards['shuttle'] != undefined) {
      	    delete discarded_cards['shuttle'];
      	  }
      	}


        if (Object.keys(discarded_cards).length > 0) {

          //
          // shuffle in discarded cards -- eliminate SHUFFLE here as unnecessary
          //
          twilight_self.addMove("DECKRESTORE\t1");
          twilight_self.addMove("DECKENCRYPT\t1\t2");
          twilight_self.addMove("DECKENCRYPT\t1\t1");
          twilight_self.addMove("DECKXOR\t1\t2");
          twilight_self.addMove("DECKXOR\t1\t1");
          twilight_self.addMove("flush\tdiscards"); // opponent should know to flush discards as we have
          twilight_self.addMove("DECK\t1\t"+JSON.stringify(discarded_cards));
          twilight_self.addMove("DECKBACKUP\t1");
          twilight_self.updateLog("cards remaining: " + twilight_self.game.deck[0].crypt.length);
          twilight_self.updateLog("Shuffling discarded cards back into the deck...");

        }
      }
    }

    twilight_self.endTurn();
    return;

  }




  /////////////////////
  // Place Influence //
  // If China card or Vietnam revolts in effect, we hold off on clearing them, because we may have 2 bonus OPs which could break control.
  /////////////////////
  uneventOpponentControlledCountries(player, card) {

    let bonus_regions = this.returnArrayOfRegionBonuses(card);

    for (var i in this.countries) {
        let bonus_region_applies = 0;
        for (let z = 0; z < bonus_regions.length; z++) {
          if (this.countries[i].region.indexOf(bonus_regions[z]) > -1) { 
            bonus_region_applies = 1; 
          }
        }

      if (player == "us") {
        if (this.isControlled("ussr", i) == 1 && bonus_region_applies == 0) {
          this.countries[i].place = 0;
          let divname = '#'+i;
          $(divname).off();
        }
      }
      if (player == "ussr") {
        if (this.isControlled("us", i) == 1 && bonus_region_applies == 0) {
          this.countries[i].place = 0;
          let divname = '#'+i;
          $(divname).off();
        }
      }
    }



  }


  /*
  Can only place influence in countries with influence or neighboring countries with your influence
  Resets the board to enable to you make your placements properly
  */
  prePlayerPlaceInfluence(player) {
    //
    // reset
    //
    for (var i in this.countries) { this.game.countries[i].place = 0; }

    //
    // ussr
    //
    if (player == "ussr") {

      this.game.countries['finland'].place = 1;
      this.game.countries['poland'].place = 1;
      this.game.countries['romania'].place = 1;
      this.game.countries['afghanistan'].place = 1;
      this.game.countries['northkorea'].place = 1;

      for (var i in this.game.countries) {
        if (this.game.countries[i].ussr > 0) {

          let place_in_country = 1;

          //
          // skip argentina if only has 1 and ironlady_before_ops
          //
          if (this.game.state.ironlady_before_ops == 1 && this.game.countries['chile'].ussr < 1 && this.game.countries['uruguay'].ussr < 1 && this.game.countries['paraguay'].ussr < 1 && this.game.countries['argentina'].ussr == 1 && i === "argentina") { place_in_country = 0; }

          this.game.countries[i].place = place_in_country;

          if (place_in_country == 1) {
            for (let n = 0; n < this.game.countries[i].neighbours.length; n++) {
              let j = this.game.countries[i].neighbours[n];
              this.game.countries[j].place = 1;
            }
          }

        }
      }
    }

    //
    // us
    //
    if (player == "us") {

      this.game.countries['canada'].place = 1;
      this.game.countries['mexico'].place = 1;
      this.game.countries['cuba'].place = 1;
      this.game.countries['japan'].place = 1;

      for (var i in this.game.countries) {
        if (this.game.countries[i].us > 0) {
          this.game.countries[i].place = 1;
          for (let n = 0; n < this.game.countries[i].neighbours.length; n++) {
            let j = this.game.countries[i].neighbours[n];
            this.game.countries[j].place = 1;
          }
        }
      }
    }

  }



  playerPlaceInitialInfluence() {
    let twilight_self = this;

    try {
      this.startClock();
      twilight_self.addMove("resolve\tplacement");


      if (this.game.player == 1) { //USSR

        this.updateStatusAndListCards(`You are the USSR. Place six additional influence in Eastern Europe.`);

        var placeable = ["finland", "eastgermany", "poland", "austria", "czechoslovakia", "hungary", "romania", "yugoslavia", "bulgaria"];
        let ops_to_place = 6;

        for (let p of placeable) {
          this.game.countries[p].place = 1;
          let divname = "#"+p;
          $(divname).addClass("easterneurope");
        } 

        $(".easterneurope").off();
        $(".easterneurope").on('click', function() {

          let countryname = $(this).attr('id');

          if (twilight_self.countries[countryname].place == 1) {
            twilight_self.addMove("place\tussr\tussr\t"+countryname+"\t1");
            twilight_self.placeInfluence(countryname, 1, "ussr");
            ops_to_place--;

            if (ops_to_place == 0) {
              twilight_self.playerFinishedPlacingInfluence();
              twilight_self.game.state.placement = 1;
              twilight_self.endTurn();
            }else{
              twilight_self.updateStatusAndListCards(`You are the USSR. Place ${ops_to_place} additional influence in Eastern Europe.`);              
            }
          } else { //Should be impossible to hit here
            twilight_self.displayModal("Invalid Influence Placement", `You cannot place there...: ${ops_to_place} influence left`);
          }
        });

        return;
      }else{ //US

        this.updateStatusAndListCards(`You are the US. Place seven additional influence in Western Europe.`)

        var placeable = ["canada", "uk", "benelux", "france", "italy", "westgermany", "greece", "spain", "turkey", "austria", "norway", "denmark", "sweden", "finland"];
        var ops_to_place = 7;

        for (let p of placeable) {
          this.game.countries[p].place = 1;
          let divname = "#"+p;
          $(divname).addClass("westerneurope");
        }

        $(".westerneurope").off();
        $(".westerneurope").on('click', function() {

          let countryname = $(this).attr('id');

          if (twilight_self.countries[countryname].place == 1) {
            twilight_self.addMove("place\tus\tus\t"+countryname+"\t1");
            twilight_self.placeInfluence(countryname, 1, "us");
            ops_to_place--;

            if (ops_to_place == 0) {
              twilight_self.playerFinishedPlacingInfluence();
              twilight_self.game.state.placement = 1;
              twilight_self.endTurn();
            }else{
              twilight_self.updateStatusAndListCards(`You are the US. Place ${ops_to_place} additional influence in Western Europe.`)              
            }
          } else { //Should be impossible to hit here
            twilight_self.displayModal("Invalid Influence Placement", `You cannot place there...: ${ops_to_place} influence left`);
          }
        });
      }
    } catch (err) { console.log("Error in playerPlaceInitialInfluence: "+err);}
  }



  playerPlaceBonusInfluence(bonus) {

    this.startClock();

    let twilight_self = this;
    
    twilight_self.addMove("resolve\tplacement_bonus");

    if (this.game.player == 1) { //USSR
      
      this.updateStatusAndListCards(`You are the USSR. Place ${bonus} additional influence in countries with existing Soviet influence.`);

      for (var i in this.game.countries) {
        if (this.game.countries[i].ussr > 0) {

          let countryname  = i;
          let divname      = '#'+i;

          $(divname).off();
          $(divname).on('click', function() {

            let countryname = $(this).attr('id');

            twilight_self.addMove("place\tussr\tussr\t"+countryname+"\t1");
            twilight_self.placeInfluence(countryname, 1, "ussr");
            bonus--;

            if (bonus == 0) {
              twilight_self.playerFinishedPlacingInfluence();
              twilight_self.game.state.placement = 1;
              twilight_self.endTurn();
            }
          });
        }
      }
    }else{ //US -- the only one who actually uses this function

      this.updateStatusAndListCards(`You are the US. Place ${bonus} additional influence in countries with existing American influence.`);

      for (var i in this.game.countries) {
        if (this.game.countries[i].us > 0) {

          let countryname  = i;
          let divname      = '#'+i;
          $(divname).addClass("westerneurope");          
        }
      }

      $(".westerneurope").off();
      $(".westerneurope").on('click', function() {

        let countryname = $(this).attr('id');
        twilight_self.addMove("place\tus\tus\t"+countryname+"\t1");
        twilight_self.placeInfluence(countryname, 1, "us");
        bonus--;

        if (bonus == 0) {
          twilight_self.playerFinishedPlacingInfluence();
          twilight_self.game.state.placement = 1;
          twilight_self.endTurn();
        }else{
          twilight_self.updateStatusAndListCards(`You are the US. Place ${bonus} additional influence in countries with existing American influence.`); 
        }
      });

    }
  }








  removeInfluence(country, inf, player, mycallback=null) {

    if (player == "us") {
      this.countries[country].us = parseInt(this.countries[country].us) - parseInt(inf);
      if (this.countries[country].us < 0) { this.countries[country].us = 0; };
    } else {
      this.countries[country].ussr = parseInt(this.countries[country].ussr) - parseInt(inf);
      if (this.countries[country].ussr < 0) { this.countries[country].ussr = 0; };
    }

    this.updateLog(player.toUpperCase() + " removes " + inf + " from " + this.countries[country].name);

    this.showInfluence(country, player, mycallback);

  }

  placeInfluence(country, inf, player, mycallback=null) {

    if (player == "us") {
      this.countries[country].us = parseInt(this.countries[country].us) + parseInt(inf);
    } else {
      this.countries[country].ussr = parseInt(this.countries[country].ussr) + parseInt(inf);
    }

    this.updateLog(player.toUpperCase() + " places " + inf + " in " + this.countries[country].name, 1);

    this.showInfluence(country, player, mycallback);

  }


  /*
   * So, why do we need to specify which "player" (e.g. "us"/"ussr") in this function? 
   */
  showInfluence(country, player="", mycallback=null) {

    let obj_us    = "#"+country+ " > .us";
    let obj_ussr = "#"+country+ " > .ussr";

    //Why do we need to parseInt?
    let us_i   = parseInt(this.countries[country].us);
    let ussr_i = parseInt(this.countries[country].ussr);

    let countryMaster = this.whoControls(country);
    
    //Update HTML for USSR and US

    if (ussr_i == 0){
      $(obj_ussr).html('');
    }else if (countryMaster === "ussr"){
      $(obj_ussr).html('<div class="ussr_control">'+ussr_i+'</div>');
    }else{
      $(obj_ussr).html('<div class="ussr_uncontrol">'+ussr_i+'</div>');
    }

    if (us_i == 0){
      $(obj_us).html('');
    }else if (countryMaster === "us"){
      $(obj_us).html('<div class="us_control">'+us_i+'</div>');
    }else{
      $(obj_us).html('<div class="us_uncontrol">'+us_i+'</div>');
    }

    //Add an animation to clue the other player into the new influence status
    if (player){
      if (!(this.game.player == 1 && player == "ussr") && !(this.game.player == 2 && player == "us")){
        $(`#${country}`).addClass("shake").delay(1500).queue(function () {
          $(this).removeClass("shake").dequeue();
        });
      }  
    }
    
    $('.us_control').css('height', this.scale(100)+"px");
    $('.us_uncontrol').css('height', this.scale(100)+"px");
    $('.ussr_control').css('height', this.scale(100)+"px");
    $('.ussr_uncontrol').css('height', this.scale(100)+"px");

    $('.us_control').css('font-size', this.scale(100)+"px");
    $('.us_uncontrol').css('font-size', this.scale(100)+"px");
    $('.ussr_control').css('font-size', this.scale(100)+"px");
    $('.ussr_uncontrol').css('font-size', this.scale(100)+"px");

    //
    // adjust screen ratio
    //
    $('.country').css('width', this.scale(202)+"px");
    $('.us').css('width', this.scale(100)+"px");
    $('.ussr').css('width', this.scale(100)+"px");
    $('.us').css('height', this.scale(100)+"px");
    $('.ussr').css('height', this.scale(100)+"px");

    //
    // update game state -- countries unchanged by this function
    // this.game.countries = this.countries;

    if (mycallback != null) { mycallback(country, player); }

  }








 

  playerPlaceInfluence(player, mycallback=null) {

    this.startClock();

    // reset off
    this.playerFinishedPlacingInfluence();

    var twilight_self = this;
    let xpos = 0;
    let ypos = 0;

    for (var i in this.countries) {

      let countryname  = i;
      let divname      = '#'+i;

      let restricted_country = 0;

      //
      // Chernobyl
      //
      if (this.game.player == 1 && this.game.state.events.chernobyl != "") {
        if (this.countries[i].region == this.game.state.events.chernobyl) { 
	        restricted_country = 1;
        }
        if (this.game.state.events.chernobyl == "asia" && this.countries[i].region == "seasia") {
          restricted_country = 1;
        }
      }

      if (this.game.state.limit_region.indexOf(this.countries[i].region) > -1) { restricted_country = 1; }

      if (restricted_country == 1) {

        $(divname).off();
        $(divname).on('click', function() {
          twilight_self.displayModal("Invalid Target");
        });

      } else {

        if (player == "us") {

          $(divname).off();
          $(divname).on('mousedown', function (e) {
            xpos = e.clientX;
            ypos = e.clientY;
          });
          $(divname).on('mouseup', async function (e) {
            if (Math.abs(xpos-e.clientX) > 4) { return; }
            if (Math.abs(ypos-e.clientY) > 4) { return; }
            //$(divname).on('click', function() {

            let countryname = $(this).attr('id');

            if (twilight_self.countries[countryname].place == 1) {

              //
              // vietnam revolts and china card - US never eligible for former
              //
              twilight_self.game.state.events.vietnam_revolts_eligible = 0;
              if (twilight_self.countries[countryname].region.indexOf("asia") < 0) { twilight_self.game.state.events.china_card_eligible = 0; }

              if (twilight_self.isControlled("ussr", countryname) == 1) { twilight_self.game.break_control = 1; }

              //
              // permit cuban missile crisis removal after placement
              //
              if (twilight_self.game.state.events.cubanmissilecrisis == 2) {
                if (countryname === "turkey" || countryname === "westgermany") {
                  if (twilight_self.countries[countryname].us >= 1) {
                    //
                    // allow player to remove CMC
                    //
                    let removeinf = await sconfirm("You are placing 1 influence in "+twilight_self.countries[countryname].name+". Once this is done, do you want to cancel the Cuban Missile Crisis by removing 2 influence in "+twilight_self.countries[countryname].name+"?");
                    if (removeinf) {
                      twilight_self.removeInfluence(countryname, 2, "us");
                      twilight_self.addMove(`remove\tus\tus\t${countryname}\t2`);
                      twilight_self.addMove("unlimit\tcmc");
                      twilight_self.addMove("NOTIFY\tUS has cancelled the Cuban Missile Crisis");
	                  	twilight_self.game.state.events.cubanmissilecrisis = 0; //for immediate effect
                    }
                    
                  }
                }
              }
              
              twilight_self.addMove("place\tus\tus\t"+countryname+"\t1");
              twilight_self.placeInfluence(countryname, 1, "us", mycallback);

            } else {
              twilight_self.displayModal("you cannot place there...");
              return;
            }
          });
        } else {

          $(divname).off();
          $(divname).on('mousedown', function (e) {
            xpos = e.clientX;
            ypos = e.clientY;
          });
          $(divname).on('mouseup', async function (e) {
            if (Math.abs(xpos-e.clientX) > 4) { return; }
            if (Math.abs(ypos-e.clientY) > 4) { return; }
            //$(divname).on('click', function() {

            let countryname = $(this).attr('id');

            if (twilight_self.countries[countryname].place == 1) {

              //
              // vietnam revolts and china card
              //
              if (twilight_self.countries[countryname].region !== "seasia") { twilight_self.game.state.events.vietnam_revolts_eligible = 0; }
              if (twilight_self.countries[countryname].region.indexOf("asia") < 0) { twilight_self.game.state.events.china_card_eligible = 0; }
              if (twilight_self.isControlled("us", countryname) == 1) { twilight_self.game.break_control = 1; }

              //
              // permit cuban missile crisis removal after placement
              //
              if (twilight_self.game.state.events.cubanmissilecrisis == 1) {
                if (countryname === "cuba") {
                  if (twilight_self.countries[countryname].ussr >= 1) {

                    //
                    // allow player to remove CMC
                    //
                    

                      let removeinf = await sconfirm("You are placing 1 influence in "+twilight_self.countries[countryname].name+". Once this is done, do you want to cancel the Cuban Missile Crisis by removing 2 influence in "+twilight_self.countries[countryname].name+"?");
                      if (removeinf) {
                        twilight_self.removeInfluence("cuba", 2, "ussr");
                        twilight_self.addMove("remove\tussr\tussr\tcuba\t2");
                        twilight_self.addMove("unlimit\tcmc");
                        twilight_self.addMove("NOTIFY\tUSSR has cancelled the Cuban Missile Crisis");
                        twilight_self.game.state.events.cubanmissilecrisis = 0; //for immediate effect
                      }
                    
                  }
                }
              }

              twilight_self.addMove("place\tussr\tussr\t"+countryname+"\t1");
              twilight_self.placeInfluence(countryname, 1, "ussr", mycallback);
            } else {
              twilight_self.displayModal("Invalid Target");
              return;
            }
          });
        } // NON RESTRICTED COUNTRY
      }
    }

  }

  removeEvents(){
    $(".country").off();
  }

  playerFinishedPlacingInfluence(player, mycallback=null) {
    
    /*for (var i in this.countries) {
      let divname      = '#'+i;
      $(divname).off();
    }*/
    $(".country").off();
    $(".easterneurope").removeClass("easterneurope");
    $(".westerneurope").removeClass("westerneurope");
    if (mycallback != null) { mycallback(); }
  }


  isSpaceRaceAvailable(ops){
        //
        // is space race an option
        //
        let sre = 1;
        if (this.game.player == 1 && this.game.state.space_race_ussr_counter >= 1) {
          if (this.game.state.animal_in_space == "ussr" && this.game.state.space_race_ussr_counter < 2) {} else {
            sre = 0;
          }
        }
        if (this.game.player == 2 && this.game.state.space_race_us_counter >= 1) {
          if (this.game.state.animal_in_space == "us" && this.game.state.space_race_us_counter < 2) {} else {
            sre = 0;
          }
        }

        if (sre == 1) {
          let myspacerace = (this.game.player == 1) ? this.game.state.space_race_ussr : this.game.state.space_race_us;
          if ((myspacerace < 4 && ops > 1) || (myspacerace < 7 && ops > 2) || ops > 3){
            return '<li class="card" id="space">space race</li>';
          }
        } 
        return "";
  }


  playerSpaceCard(card, player) {

    let card_ops = this.game.deck[0].cards[card].ops;

    // stats
    if (player == "us") { this.game.state.stats.us_ops_spaced += this.modifyOps(card_ops, card, player); }
    if (player == "ussr") { this.game.state.stats.ussr_ops_spaced += this.modifyOps(card_ops, card, player); }

    /* Track attempts to advance in the space race, normally 1 per turn*/
    if (player == "ussr") {
      this.game.state.space_race_ussr_counter++;
    } else {
      this.game.state.space_race_us_counter++;
    }

    let roll = this.rollDice(6);

    let successful     = 0;
    let box       = (player == "ussr") ? this.game.state.space_race_ussr : this.game.state.space_race_us;
    
    //console.log(this.game.state.space_race_ussr,this.game.state.space_race_us,box);

    if (box == 0) { if (roll < 4) { successful = 1; } }
    if (box == 1) { if (roll < 5) { successful = 1; } }
    if (box == 2) { if (roll < 4) { successful = 1; } }
    if (box == 3) { if (roll < 5) { successful = 1; } }
    if (box == 4) { if (roll < 4) { successful = 1; } }
    if (box == 5) { if (roll < 5) { successful = 1; } }
    if (box == 6) { if (roll < 4) { successful = 1; } }
    if (box == 7) { if (roll < 3) { successful = 1; } }

    if (successful == 1) {
      this.updateLog(player.toUpperCase() + ` advances in the Space Race with roll ${roll}`);
      this.advanceSpaceRace(player);
    } else {
      this.updateLog(player.toUpperCase() + ` fails in the Space Race with roll ${roll}`);
      this.displayModal(player.toUpperCase() + " fails to advance in the Space Race");
    }

  }




  ///////////
  // COUPS //
  ///////////
  playerCoupCountry(player,  ops, card) {

    var twilight_self = this;

    $(".country").off();
    $(".country").on('click', async function() {
      
      let countryname = $(this).attr('id');

      //
      // sanity DEFCON check
      //
      if (twilight_self.game.state.defcon == 2 && twilight_self.game.countries[countryname].bg == 1 &&
          !(player == "us" && twilight_self.game.state.events.nuclearsubs == 1)) {
        let c = await sconfirm("Are you sure you wish to coup a Battleground State? (DEFCON is 2)"); 
        if (c) {
        } else {
          twilight_self.playOps(player, ops, card);
          return;
        }
      }

      let coupHeader = `Cannot Coup ${twilight_self.countries[countryname].name}`;
      let failureReason = ""; //Also tells us if it is a valid target

      //
      // Coup Restrictions
      //
      if (twilight_self.game.state.limit_ignoredefcon == 0) {
        if (twilight_self.game.state.limit_region.indexOf(twilight_self.countries[countryname].region) > -1) {
          failureReason = "Invalid Region for this Coup";
          
        }
        if (twilight_self.countries[countryname].region == "europe" && twilight_self.game.state.defcon < 5) {
          failureReason = "DEFCON prevents coups in Europe";
          
        }
        if ((twilight_self.countries[countryname].region == "asia" || twilight_self.countries[countryname].region == "seasia") && twilight_self.game.state.defcon < 4) {
          failureReason = "DEFCON prevents coups in Asia";
        }

        if (twilight_self.countries[countryname].region == "mideast" && twilight_self.game.state.defcon < 3) {
          failureReason = "DEFCON prevents coups in the Middle-East";
        }
      }


      // US / Japan Restrictions
      if (twilight_self.game.state.events.usjapan == 1 && countryname == "japan" && player == "ussr") {
        failureReason = "US/Japan Alliance prevents coups in Japan";
      }

      /*
      WATCH OUT for LOGIC failure in the next two if-blocks, the realities of defcon blocking coups means that the logic has likely never been tested
      */

      // Nato Coup Restriction
      if (twilight_self.countries[countryname].region == "europe" && twilight_self.game.state.events.nato == 1 && player == "ussr") {
        if (twilight_self.isControlled("us", countryname) == 1) {
          if ( (countryname == "westgermany" && twilight_self.game.state.events.nato_westgermany == 0) || (countryname == "france" && twilight_self.game.state.events.nato_france == 0) ) {
            //If West Germany or France have been removed from Nato (by Degaulle or WillyBrandt), then one can coup there....
          } else {
            failureReason = "NATO prevents coups of US-controlled countries in Europe";
          }
        }
      }

      // The Reformer Coup Restriction
      if (twilight_self.countries[countryname].region == "europe" && twilight_self.game.state.events.reformer == 1 && player == "ussr") {
        failureReason = "The Reformer prevents USSR coup attempts in Europe";
      }

     if ((player == "us" && twilight_self.countries[countryname].ussr <= 0) || (player == "ussr" && twilight_self.countries[countryname].us <= 0)) {
        failureReason = "No enemy influence";
      } 


      if (failureReason.length > 0) { 
        twilight_self.displayModal(coupHeader, failureReason);
      } else {
        //
        // china card regional bonuses
        //
        if (card == "china" && (twilight_self.game.countries[countryname].region == "asia" || twilight_self.game.countries[countryname].region == "seasia")) {
          twilight_self.updateLog("China bonus OP added to coup in Asia...");
          ops++;
        }
        if (player == "ussr" && twilight_self.game.state.events.vietnam_revolts == 1 && twilight_self.game.countries[countryname].region == "seasia") {
    	    if (twilight_self.returnOpsOfCard(card) == 1 && twilight_self.game.state.events.redscare_player1 >= 1) {
            twilight_self.updateLog("Vietnam Revolts bonus OP negated by Red Purge");
    	    } else { 
            twilight_self.updateLog("Vietnam Revolts bonus OP added to Southeast Asia coup...");
            ops++;
          }
        }

        twilight_self.addMove("coup\t"+player+"\t"+countryname+"\t"+ops+"\t"+card);
        twilight_self.endTurn();
      }

    });
    
  }




  playCoup(player, countryname, ops, mycallback=null) {

    let roll    = this.rollDice(6);
    let modifier = 0;

    //
    // Cuban Missile Crisis
    //
    if (player == "ussr" && this.game.state.events.cubanmissilecrisis == 1) {
      this.endGame(this.game.players[1], "Cuban Missile Crisis");
      return;
    }
    if (player == "us" && this.game.state.events.cubanmissilecrisis == 2) {
      this.endGame(this.game.players[0], "Cuban Missile Crisis");
      return;
    }

    // stats
    if (player == "us") { this.game.state.stats.us_coups.push(roll); }
    if (player == "ussr") { this.game.state.stats.ussr_coups.push(roll); }

    //
    // Yuri and Samantha
    //
    if (this.game.state.events.yuri == 1) {
      if (player == "us") {
        this.game.state.vp -= 1;
        this.updateVictoryPoints();
        this.updateLog(`USSR gains 1 VP from ${this.cardToText("yuri")}`);
      }
    }

    //
    // Salt Negotiations
    //
    if (this.game.state.events.saltnegotiations == 1) {
      this.updateLog(`${this.cardToText("saltnegotiations")}: -1 modifier on coups`);
      modifier--;
    }

    //
    // Latin American Death Squads
    //
    if (this.game.state.events.deathsquads != 0) {
      if (this.game.state.events.deathsquads <= -1) {
	let roll_modifier = Math.abs(this.game.state.events.deathsquads);
        if (this.countries[countryname].region == "camerica" || this.countries[countryname].region == "samerica") {
          if (player == "ussr") {
            this.updateLog(`${this.cardToText("deathsquads")} triggers: USSR +"+roll_modifier+" modifier`);
            modifier += roll_modifier;
          }
          if (player == "us")   {
            if (this.countries[countryname].region == "camerica" || this.countries[countryname].region == "samerica") {
              this.updateLog(`${this.cardToText("deathsquads")} triggers: US -"+roll_modifier+" modifier`);
              modifier -= roll_modifier;
            }
          }
        }
      }
      if (this.game.state.events.deathsquads >= 1) {
        let roll_modifier = this.game.state.events.deathsquads;
        if (this.countries[countryname].region == "camerica" || this.countries[countryname].region == "samerica") {
          if (player == "ussr") {
            this.updateLog(`${this.cardToText("deathsquads")} triggers: USSR -"+roll_modifier+" modifier`);
            modifier -= roll_modifier;
          }
          if (player == "us")   {
            this.updateLog(`${this.cardToText("deathsquads")} triggers: US +"+roll_modifier+" modifier`);
            modifier += roll_modifier;
          }
        }
      }
    }

    //
    // END OF HISTORY (INF Treaty and CMC)
    //
    if (this.game.state.events.inftreaty == 1) {
        this.updateLog(`${this.cardToText("inftreaty")} -1 modifier on coups`);
        modifier--;
    }

console.log("DEFCON MONITOR: about to lower defcon in coup logic 1...");

    // Lower Defcon in BG countries unless US has nuclear subs or special condition flagged
    if (this.countries[countryname].bg == 1 && this.game.state.lower_defcon_on_coup == 1) {
      if (player !== "us" || this.game.state.events.nuclearsubs == 0 ){
console.log("DEFCON MONITOR: about to lower defcon in coup logic 2...");
        this.lowerDefcon();
      }
    }

    let stability = parseInt(this.countries[countryname].control); //Just for some reason

    if (modifier != 0) {
      roll = (roll+modifier);
      this.updateLog(`COUP: ${player.toUpperCase()} modified roll: ${roll}`);
    } else {
      this.updateLog(`COUP: ${player.toUpperCase()} rolls ${roll}`);
    }

    let winning = roll + ops - (stability * 2);

 
    if (winning > 0) {

      if (this.browser_active == 1) {
        this.displayModal(`COUP in ${this.countries[countryname].name}!`, `${player.toUpperCase()} successfully shifts influence in by ${winning}`);
      }

      let removed = 0;
      let gained = 0;
      this.updateLog(`${player.toUpperCase()}'s coup succeeds in ${this.countries[countryname].name}.`);

      if (player == "us") {
        removed = Math.min(winning, this.countries[countryname].ussr);
        gained = winning - removed;
        if (removed > 0){
          this.removeInfluence(countryname, removed, "ussr");
        }
      }else{
        removed = Math.min(winning, this.countries[countryname].us);
        gained = winning - removed;
        if (removed > 0){
          this.removeInfluence(countryname, removed, "us");
        }
      }
      this.placeInfluence(countryname, gained, player);
    
    } else {
      if ((player == "us" && this.game.player == 2) || (player == "ussr" && this.game.player == 1) ) {
        this.displayModal(`COUP FAILS!`);
      }else{
        this.displayModal(`COUP in ${this.countries[countryname].name}!`,"Your forces repel the coup and the government remains in power");
      }
      
      this.updateLog(`${player.toUpperCase()}'s coup in ${this.countries[countryname].name} fails, no change in influence`);
    }


    if (mycallback != null) {
      mycallback();
    }

    return;
  }



  playRealign(player, country) {
   
      this.updateLog(player.toUpperCase() + " attempts to realign " + this.countries[country].name);

      let bonus_us = 0;
      let bonus_ussr = 0;

      if (this.countries[country].us > this.countries[country].ussr) {
        bonus_us++;
      }
      if (this.countries[country].ussr > this.countries[country].us) {
        bonus_ussr++;
      }
      for (let z = 0; z < this.countries[country].neighbours.length; z++) {
        let racn = this.countries[country].neighbours[z];
        if (this.isControlled("us", racn) == 1) {
          bonus_us++;
        }
        if (this.isControlled("ussr", racn) == 1) {
          bonus_ussr++;
        }
      }

      //
      // handle adjacent influence
      //
      if (country === "mexico") { bonus_us++; }
      if (country === "cuba")   { bonus_us++; }
      if (country === "japan")  { bonus_us++; }
      if (country === "canada") { bonus_us++; }
      if (country === "finland") { bonus_ussr++; }
      if (country === "poland") { bonus_ussr++; }
      if (country === "romania") { bonus_ussr++; }
      if (country === "afghanistan") { bonus_ussr++; }
      if (country === "northkorea") { bonus_ussr++; }


      //
      // Iran-Contra Scandal
      //
      if (this.game.state.events.irancontra == 1) {
        this.updateLog("Iran-Contra Scandal -1 modification on US roll");
        bonus_us--;
      }

      let roll_us   = this.rollDice(6);
      let roll_ussr = this.rollDice(6);

      

      roll_us   = roll_us + bonus_us;
      roll_ussr = roll_ussr + bonus_ussr;

      if (roll_us > roll_ussr) {
        this.updateLog(`US wins realignment roll with ${roll_us} (incl. ${bonus_us} bonus) vs. USSR ${roll_ussr} (incl. ${bonus_ussr} bonus)`);
        let diff = roll_us - roll_ussr;
        if (this.countries[country].ussr > 0) {
          diff = Math.min(diff, this.countries[country].ussr);
          this.removeInfluence(country, diff, "ussr");
        }
      }else if (roll_us < roll_ussr) {
        this.updateLog(`USSR wins realignment roll with ${roll_ussr} (incl. ${bonus_ussr} bonus) vs. US ${roll_us} (incl. ${bonus_us} bonus)`);
        let diff = roll_ussr - roll_us;
        if (this.countries[country].us > 0) {
          diff = Math.min(diff, this.countries[country].us);
          this.removeInfluence(country, diff, "us");
        }
      }else{
        this.updateLog(`Realignment roll is a draw! US [${roll_us-bonus_us} + ${bonus_us}] = USSR [${roll_ussr-bonus_ussr} + ${bonus_ussr}]`);
      }
   
  }








  ///////////////////////
  // Twilight Specific //
  ///////////////////////
  removeMove() {
    return this.moves.pop();
  }

  endTurn(nextTarget=0) {

    //
    // cancel back button on subsequent cards picks
    //
    //this.game.state.back_button_cancelled = 1;


    //
    // show active events
    //
    this.updateEventTiles();


    this.updateStatus("<div class='status-message' id='status-message'>Submitting moves... awaiting response from peers...</div>");

    //
    // remove events from board to prevent "Doug Corley" gameplay
    //
    try {
    $(".card").off();
    $(".country").off();
    } catch (err) {}

    //
    // we will bury you scores first!
    //
    if (this.game.state.events.wwby_triggers == 1) {
      this.addMove(`NOTIFY\t${this.cardToText("wwby")} triggers +3 VP for USSR`);
      this.addMove("vp\tussr\t3");
      this.game.state.events.wwby_triggers = 0;
    }

    let extra = {};
    this.game.turn = this.moves;
    this.moves = [];
    this.sendMessage("game", extra);

  }


  undoMove(move_type, num_of_moves) {

    switch(move_type) {
      case 'place':
        // iterate through the queue and remove past moves
        // cycle through past moves to know what to revert
        for (let i = 0; i < num_of_moves; i++) {
          let last_move = this.removeMove();
          last_move = last_move.split('\t');
          let player = last_move[2];
          let country = last_move[3];
          let ops = last_move[4];

          let opponent = "us";
          if (player == "us") { opponent = "ussr"; }
          this.removeInfluence(country, ops, player);

          //
          // if the country is now enemy controlled, it must have taken an extra move
          // for the play to place there....
          //
          if (this.isControlled(opponent, country) == 1) {
            i++;
          }
        }

        // use this to clear the "resolve ops" move
        this.removeMove();
        return 1;
      default:
        break;
        return 0;
    }
  }


  identifyPlayer(player){
    return this.playerRoles[player].toUpperCase();
  }
  identifyPlayerByPublicKey(pkey){
    let player = this.game.players.indexOf(pkey);
    if (player >= 0 && player < this.game.players.length){
      return this.identifyPlayer(player+1);  
    }else{
      return "";
    }
    
  }

  displayBoard() {
    this.updateDefcon();
    this.updateActionRound();
    this.updateSpaceRace();
    this.updateVictoryPoints();
    this.updateMilitaryOperations();
    this.updateRound();
  }


  endRound() {

    is_player_skipping_playing_china_card = 0;

    this.game.state.round++;
    this.game.state.turn 		= 0;
    this.game.state.turn_in_round = 0;
    this.game.state.move 		= 0;

    //
    // game over if scoring card is held
    //
    if (this.game.state.round > 1) {
      for (let i = 0 ; i < this.game.deck[0].hand.length; i++) {
        if (this.game.deck[0].hand[i] != "china") {
          if (this.game.deck[0].cards[this.game.deck[0].hand[i]]?.scoring == 1) {
            this.game.over = 1;
            //There may be an issue if both players simulataneously resign...
            this.resignGame(this.game.id, "scoring card held");
            return 0;
          }
	      }
      }
    }


    //
    // calculate milops
    //
    if (this.game.state.round > 1) {
      let milops_needed = this.game.state.defcon;
      let ussr_milops_deficit = (this.game.state.defcon-this.game.state.milops_ussr);
      let us_milops_deficit = (this.game.state.defcon-this.game.state.milops_us);

      if (ussr_milops_deficit > 0) {
        this.game.state.vp += ussr_milops_deficit;
        this.updateLog("USSR penalized " + ussr_milops_deficit + " VP (milops)");
      }
      if (us_milops_deficit > 0) {
        this.game.state.vp -= us_milops_deficit;
        this.updateLog("US penalized " + us_milops_deficit + " VP (milops)");
      }
    }

    this.game.state.us_defcon_bonus = 0;

    this.game.state.milops_us = 0;
    this.game.state.milops_ussr = 0;

    this.game.state.headline = 0;

    //Reset SpaceRace Attempts
    this.game.state.space_race_us_counter = 0;
    this.game.state.space_race_ussr_counter = 0;
    this.game.state.eagle_has_landed_bonus_taken = 0;
    this.game.state.space_station_bonus_taken = 0;

    // set to 1 when ironlady events before ops played (by ussr - limits placement to rules)
    this.game.state.ironlady_before_ops = 0;

    this.game.state.events.wwby_triggers = 0;
    this.game.state.events.region_bonus = "";
    this.game.state.events.u2 = 0;
    this.game.state.events.containment = 0;
    this.game.state.events.brezhnev = 0;
    this.game.state.events.redscare_player1 = 0;
    this.game.state.events.redscare_player2 = 0;
    this.game.state.events.vietnam_revolts = 0;
    this.game.state.events.vietnam_revolts_eligible = 0;
    this.game.state.events.deathsquads = 0;
    this.game.state.events.missileenvy = 0;
    this.game.state.events.cubanmissilecrisis = 0;
    this.game.state.events.nuclearsubs = 0;
    this.game.state.events.saltnegotiations = 0;
    this.game.state.events.northseaoil_bonus = 0;
    this.game.state.events.yuri = 0;
    this.game.state.events.irancontra = 0;
    this.game.state.events.chernobyl = "";
    this.game.state.events.aldrich = 0;

    //
    // increase DEFCON by one
    //
    this.game.state.defcon++;
    if (this.game.state.defcon > 5) { this.game.state.defcon = 5; }
    this.game.state.ussr_milops = 0;
    this.game.state.us_milops = 0;


    this.displayBoard();

    //
    // give me the china card if needed -- OBSERVER
    //
    if (this.game.player != 0) {
      let do_i_have_the_china_card = 0;
      for (let i = 0; i < this.game.deck[0].hand.length; i++) {
        if (this.game.deck[0].hand[i] == "china") {
          do_i_have_the_china_card = 1;
        }
      }
      if (do_i_have_the_china_card == 0) {
        if (this.game.player == 1) {
          if (this.game.state.events.china_card == 1) {
            if (!this.game.deck[0].hand.includes("china")) {
              this.game.deck[0].hand.push("china");
            }
          }
        }
        if (this.game.player == 2) {
          if (this.game.state.events.china_card == 2) {
            if (!this.game.deck[0].hand.includes("china")) {
              this.game.deck[0].hand.push("china");
            }
          }
        }
      }
    }
    this.game.state.events.china_card = 0;
    this.game.state.events.china_card_eligible = 0;

    return 1;
  }




  whoHasTheChinaCard() {

    //
    // the observer has no clue
    //
    if (this.game.player == 0) {
      return "ussr";
    }

    let do_i_have_the_china_card = 0;

    for (let i = 0; i < this.game.deck[0].hand.length; i++) {
      if (this.game.deck[0].hand[i] == "china") {
        do_i_have_the_china_card = 1;
      }
    }

    if (do_i_have_the_china_card == 0) {
      if (this.game.player == 1) {
        if (this.game.state.events.china_card == 1) {
          if (!this.game.deck[0].hand.includes("china")) {
            return "us";
          } else {
            return "ussr";
          }
        } else {
          if (do_i_have_the_china_card == 1) {
            return "ussr";
          } else {
            return "us";
          }
        }
      }
      if (this.game.player == 2) {
        if (this.game.state.events.china_card == 2) {
          if (!this.game.deck[0].hand.includes("china")) {
            return "ussr";
          } else {
            return "us";
          }
        } else {
          if (do_i_have_the_china_card == 1) {
            return "us";
          } else {
            return "ussr";
          }
        }
      }
    } else {
      if (this.game.player == 1) { return "ussr"; }
      if (this.game.player == 2) { return "us"; }
    }

    //
    // we should never hit this
    //

  }


  addCardToHand(card) {
    if (this.game.player == 0) { return; }
    this.game.deck[0].hand.push(card);
  }
  removeCardFromHand(card) {
    if (this.game.player == 0) { return; }
    for (i = 0; i < this.game.deck[0].hand.length; i++) {
      if (this.game.deck[0].hand[i] == card) {
        this.game.deck[0].hand.splice(i, 1);
      }
    }
  }


  ////////////////////
  // Core Game Data //
  ////////////////////
  returnState() {

    var state = {};

    state.dealt = 0;
    state.back_button_cancelled = 0;
    state.placement = 0;
    state.headline  = 0;
    state.headline_hash = "";
    state.headline_card = "";
    state.headline_xor = "";
    state.headline_opponent_hash = "";
    state.headline_opponent_card = "";
    state.headline_opponent_xor = "";
    state.round = 0;
    state.turn  = 0;
    state.turn_in_round = 0;
    state.broke_control = 0;
    state.us_efcon_bonus = 0;
    state.opponent_cards_in_hand = 0;
    state.event_before_ops = 0;
    state.event_name = "";
    state.player_to_go = 1; // used in headline to track phasing player (primarily for assigning losses for defcon lowering stunts)

    state.lower_defcon_on_coup = 1;

    state.vp_outstanding = 0; // vp not settled yet

    state.space_race_us = 0;
    state.space_race_ussr = 0;

    state.animal_in_space = "";
    state.man_in_earth_orbit = "";
    state.eagle_has_landed = "";
    state.eagle_has_landed_bonus_taken = 0;
    state.space_station = "";
    state.space_station_bonus_taken = 0;

    state.space_race_us_counter = 0;
    state.space_race_ussr_counter = 0;

    state.limit_coups = 0;
    state.limit_realignments = 0;
    state.limit_placement = 0;
    state.limit_spacerace = 0;
    state.limit_region = [];
    state.limit_ignoredefcon = 0;

    // track as US (+) and USSR (-)
    state.vp    = 0;

    state.ar_ps         = [];

    // relative --> top: 38px
    state.ar_ps[0]      = { top : 208 , left : 920 };
    state.ar_ps[1]      = { top : 208 , left : 1040 };
    state.ar_ps[2]      = { top : 208 , left : 1155 };
    state.ar_ps[3]      = { top : 208 , left : 1270 };
    state.ar_ps[4]      = { top : 208 , left : 1390 };
    state.ar_ps[5]      = { top : 208 , left : 1505 };
    state.ar_ps[6]      = { top : 208 , left : 1625 };
    state.ar_ps[7]      = { top : 208 , left : 1740 };

    state.vp_ps     = [];
    state.vp_ps[0]  = { top : 2460, left : 3040 };
    state.vp_ps[1]  = { top : 2460, left : 3300 };
    state.vp_ps[2]  = { top : 2460, left : 3435 };
    state.vp_ps[3]  = { top : 2460, left : 3570 };
    state.vp_ps[4]  = { top : 2460, left : 3705 };
    state.vp_ps[5]  = { top : 2460, left : 3840 };
    state.vp_ps[6]  = { top : 2460, left : 3975 };
    state.vp_ps[7]  = { top : 2460, left : 4110 };

    state.vp_ps[8]  = { top : 2600, left : 3035 };
    state.vp_ps[9]  = { top : 2600, left : 3170 };
    state.vp_ps[10]  = { top : 2600, left : 3305 };
    state.vp_ps[11]  = { top : 2600, left : 3435 };
    state.vp_ps[12]  = { top : 2600, left : 3570 };
    state.vp_ps[13]  = { top : 2600, left : 3705 };
    state.vp_ps[14]  = { top : 2600, left : 3840 };
    state.vp_ps[15]  = { top : 2600, left : 3975 };
    state.vp_ps[16]  = { top : 2600, left : 4110 };

    state.vp_ps[17]  = { top : 2740, left : 3035 };
    state.vp_ps[18]  = { top : 2740, left : 3170 };
    state.vp_ps[19]  = { top : 2740, left : 3305 };
    state.vp_ps[20]  = { top : 2740, left : 3570 };
    state.vp_ps[21]  = { top : 2740, left : 3840 };
    state.vp_ps[22]  = { top : 2740, left : 3975 };
    state.vp_ps[23]  = { top : 2740, left : 4110 };

    state.vp_ps[24]  = { top : 2880, left : 3035 };
    state.vp_ps[25]  = { top : 2880, left : 3170 };
    state.vp_ps[26]  = { top : 2880, left : 3305 };
    state.vp_ps[27]  = { top : 2880, left : 3435 };
    state.vp_ps[28]  = { top : 2880, left : 3570 };
    state.vp_ps[29]  = { top : 2880, left : 3705 };
    state.vp_ps[30]  = { top : 2880, left : 3840 };
    state.vp_ps[31]  = { top : 2880, left : 3975 };
    state.vp_ps[32]  = { top : 2880, left : 4110 };

    state.vp_ps[33]  = { top : 3025, left : 3035 };
    state.vp_ps[34]  = { top : 3025, left : 3170 };
    state.vp_ps[35]  = { top : 3025, left : 3305 };
    state.vp_ps[36]  = { top : 3025, left : 3435 };
    state.vp_ps[37]  = { top : 3025, left : 3570 };
    state.vp_ps[38]  = { top : 3025, left : 3705 };
    state.vp_ps[39]  = { top : 3025, left : 3840 };
    state.vp_ps[40]  = { top : 3025, left : 3975 };

    state.space_race_ps = [];
    state.space_race_ps[0] = { top : 510 , left : 3465 }
    state.space_race_ps[1] = { top : 510 , left : 3638 }
    state.space_race_ps[2] = { top : 510 , left : 3810 }
    state.space_race_ps[3] = { top : 510 , left : 3980 }
    state.space_race_ps[4] = { top : 510 , left : 4150 }
    state.space_race_ps[5] = { top : 510 , left : 4320 }
    state.space_race_ps[6] = { top : 510 , left : 4490 }
    state.space_race_ps[7] = { top : 510 , left : 4660 }
    state.space_race_ps[8] = { top : 510 , left : 4830 }

    state.milops_us = 0;
    state.milops_ussr = 0;

    state.milops_ps    = [];
    state.milops_ps[0]  = { top : 2940 , left : 1520 };
    state.milops_ps[1]  = { top : 2940 , left : 1675 };
    state.milops_ps[2]  = { top : 2940 , left : 1830 };
    state.milops_ps[3]  = { top : 2940 , left : 1985 };
    state.milops_ps[4]  = { top : 2940 , left : 2150 };
    state.milops_ps[5]  = { top : 2940 , left : 2305 };

    state.defcon = 5;

    state.defcon_ps    = [];
    state.defcon_ps[0] = { top : 2585, left : 1520 };
    state.defcon_ps[1] = { top : 2585, left : 1675 };
    state.defcon_ps[2] = { top : 2585, left : 1830 };
    state.defcon_ps[3] = { top : 2585, left : 1985 };
    state.defcon_ps[4] = { top : 2585, left : 2140 };

    state.round_ps    = [];
    state.round_ps[0] = { top : 150, left : 3473 };
    state.round_ps[1] = { top : 150, left : 3627 };
    state.round_ps[2] = { top : 150, left : 3781 };
    state.round_ps[3] = { top : 150, left : 3935 };
    state.round_ps[4] = { top : 150, left : 4098 };
    state.round_ps[5] = { top : 150, left : 4252 };
    state.round_ps[6] = { top : 150, left : 4405 };
    state.round_ps[7] = { top : 150, left : 4560 };
    state.round_ps[8] = { top : 150, left : 4714 };
    state.round_ps[9] = { top : 150, left : 4868 };

    // stats - statistics
    state.stats = {};
    state.stats.us_scorings = 0;
    state.stats.ussr_scorings = 0;
    state.stats.us_ops = 0;
    state.stats.ussr_ops = 0;
    state.stats.us_us_ops = 0;
    state.stats.ussr_us_ops = 0;
    state.stats.us_ussr_ops = 0;
    state.stats.ussr_ussr_ops = 0;
    state.stats.us_neutral_ops = 0;
    state.stats.ussr_neutral_ops = 0;
    state.stats.us_ops_spaced = 0;
    state.stats.ussr_ops_spaced = 0;
    state.stats.us_coups = [];
    state.stats.ussr_coups = [];
    state.stats.round = [];

    // events - early war
    state.events = {};
    state.events.optional = {};			// optional cards -- makes easier to search for
    state.events.formosan           = 0;
    state.events.redscare_player1   = 0;
    state.events.redscare_player2   = 0;
    state.events.containment        = 0;
    state.events.degaulle           = 0;
    state.events.nato               = 0;
    state.events.nato_westgermany   = 0;
    state.events.nato_france        = 0;
    state.events.marshall           = 0;
    state.events.warsawpact         = 0;
    state.events.unintervention     = 0;
    state.events.usjapan            = 0;
    state.events.norad              = 0;

    // regional bonus events
    state.events.vietnam_revolts     = 0;
    state.events.vietnam_revolts_eligible = 0;
    state.events.china_card          = 0;
    state.events.china_card_facedown = 0;
    state.events.china_card_in_play  = 0;
    state.events.china_card_eligible = 0;

    // events - mid-war
    state.events.northseaoil        = 0;
    state.events.johnpaul           = 0;
    state.events.ourmanintehran     = 0;
    state.events.kitchendebates     = 0;
    state.events.brezhnev           = 0;
    state.events.wwby               = 0;
    state.events.wwby_triggers      = 0;
    state.events.willybrandt        = 0;
    state.events.shuttlediplomacy   = 0;
    state.events.deathsquads        = 0;
    state.events.campdavid          = 0;
    state.events.cubanmissilecrisis = 0;
    state.events.saltnegotiations   = 0;
    state.events.missileenvy        = 0; // tracks whether happening
    state.events.missile_envy       = 0; // to whom
    state.events.flowerpower        = 0;
    state.events.beartrap           = 0;
    state.events.quagmire           = 0;

    // events - late war
    state.events.awacs              = 0;
    state.events.starwars           = 0;
    state.events.teardown           = 0;
    state.events.iranianhostage     = 0;
    state.events.ironlady           = 0;
    state.events.reformer           = 0;
    state.events.northseaoil        = 0;
    state.events.northseaoil_bonus  = 0;
    state.events.evilempire         = 0;
    state.events.yuri               = 0;
    state.events.aldrich            = 0;
    state.wargames_concession       = 6;

    //
    // events END OF HISTORY
    //
    state.events.inftreaty          = 0;


    //
    // events COLD WAR CRAZIES
    //
    state.events.communi          = 0;



    return state;

  }


  returnCountries() {

    var countries = {};

    // EUROPE
    countries['canada'] = { top : 752, left : 842 , us : 2 , ussr : 0 , control : 4 , bg : 0 , neighbours : [ 'uk' ] , region : "europe" , name : "Canada" };
    countries['uk'] = { top : 572, left : 1690 , us : 5 , ussr : 0 , control : 5 , bg : 0 , neighbours : [ 'canada','norway','benelux','france' ] , region : "europe" , name : "UK" };
    countries['benelux'] = { top : 728, left : 1860 , us : 0 , ussr : 0 , control : 3 , bg : 0 , neighbours : [ 'uk','westgermany' ] , region : "europe" , name : "Benelux" };
    countries['france'] = { top : 906, left : 1820 , us : 0 , ussr : 0 , control : 3 , bg : 1 , neighbours : [ 'algeria', 'uk','italy','spain','westgermany' ] , region : "europe" , name : "France" };
    countries['italy'] = { top : 1036, left : 2114 , us : 0 , ussr : 0 , control : 2 , bg : 1 , neighbours : [ 'spain','france','greece','austria','yugoslavia' ] , region : "europe" , name : "Italy" };
    countries['westgermany'] = { top : 728, left : 2078 , us : 0 , ussr : 0 , control : 4 , bg : 1 , neighbours : [ 'austria','france','benelux','denmark','eastgermany' ] , region : "europe" , name : "West Germany" };
    countries['eastgermany'] = { top : 580, left : 2156 , us : 0 , ussr : 3 , control : 3 , bg : 1 , neighbours : [ 'westgermany','poland','austria','czechoslovakia' ] , region : "europe" , name : "East Germany" };
    countries['poland'] = { top : 580, left : 2386 , us : 0 , ussr : 0 , control : 3 , bg : 1 , neighbours : [ 'eastgermany','czechoslovakia' ] , region : "europe" , name : "Poland" };
    countries['spain'] = { top : 1118, left : 1660 , us : 0 , ussr : 0 , control : 2 , bg : 0 , neighbours : [ 'morocco', 'france','italy' ] , region : "europe" , name : "Spain" };
    countries['greece'] = { top : 1200, left : 2392 , us : 0 , ussr : 0 , control : 2 , bg : 0 , neighbours : [ 'italy','turkey','yugoslavia','bulgaria' ] , region : "europe" , name : "Greece" };
    countries['turkey'] = { top : 1056, left : 2788 , us : 0 , ussr : 0 , control : 2 , bg : 0 , neighbours : [ 'syria', 'greece','romania','bulgaria' ] , region : "europe"  , name : "Turkey"};
    countries['yugoslavia'] = { top : 1038, left : 2342 , us : 0 , ussr : 0 , control : 3 , bg : 0 , neighbours : [ 'italy','hungary','romania','greece' ] , region : "europe" , name : "Yugoslavia" };
    countries['bulgaria'] = { top : 1038, left : 2570 , us : 0 , ussr : 0 , control : 3 , bg : 0 , neighbours : [ 'greece','turkey' ] , region : "europe" , name : "Bulgaria" };

    countries['romania'] = { top : 880, left : 2614 , us : 0 , ussr : 0 , control : 3 , bg : 0 , neighbours : [ 'turkey','hungary','yugoslavia' ] , region : "europe" , name : "Romania" };
    countries['hungary'] = { top : 880, left : 2394 , us : 0 , ussr : 0 , control : 3 , bg : 0 , neighbours : [ 'austria','czechoslovakia','romania','yugoslavia' ] , region : "europe" , name : "Hungary" };
    countries['austria'] = { top : 880, left : 2172 , us : 0 , ussr : 0 , control : 4 , bg : 0 , neighbours : [ 'hungary','italy','westgermany','eastgermany' ] , region : "europe" , name : "Austria" };
    countries['czechoslovakia'] = { top : 728, left : 2346 , us : 0 , ussr : 0 , control : 3 , bg : 0 , neighbours : [ 'hungary','poland','eastgermany' ] , region : "europe" , name : "Czechoslovakia" };
    countries['denmark'] = { top : 432, left : 1982 , us : 0 , ussr : 0 , control : 3 , bg : 0 , neighbours : [ 'sweden','westgermany' ] , region : "europe" , name : "Denmark" };
    countries['norway'] = { top : 278, left : 1932 , us : 0 , ussr : 0 , control : 4 , bg : 0 , neighbours : [ 'uk','sweden' ] , region : "europe" , name : "Norway" };
    countries['finland'] = { top : 286, left : 2522 , us : 0 , ussr : 1 , control : 4 , bg : 0 , neighbours : [ 'sweden' ] , region : "europe" , name : "Finland" };
    countries['sweden'] = { top : 410, left : 2234 , us : 0 , ussr : 0 , control : 4 , bg : 0 , neighbours : [ 'finland','denmark','norway' ] , region : "europe" , name : "Sweden" };

    // MIDDLE EAST
    countries['libya'] = { top : 1490, left : 2290, us : 0 , ussr : 0 , control : 2 , bg : 1 , neighbours : [ 'egypt','tunisia' ] , region : "mideast" , name : "Libya" };
    countries['egypt'] = { top : 1510, left : 2520, us : 0 , ussr : 0 , control : 2 , bg : 1 , neighbours : [ 'libya','sudan','israel' ], region : "mideast"  , name : "Egypt"};
    countries['lebanon'] = { top : 1205, left : 2660, us : 0 , ussr : 0 , control : 1 , bg : 0 , neighbours : [ 'syria','jordan','israel' ], region : "mideast"  , name : "Lebanon"};
    countries['syria'] = { top : 1205, left : 2870, us : 0 , ussr : 1 , control : 2 , bg : 0 , neighbours : [ 'lebanon','turkey','israel' ], region : "mideast"  , name : "Syria"};
    countries['israel'] = { top : 1350, left : 2620, us : 1 , ussr : 0 , control : 4 , bg : 1 , neighbours : [ 'egypt','jordan','lebanon','syria' ], region : "mideast" , name : "Israel" };
    countries['iraq'] = { top : 1350, left : 2870, us : 0 , ussr : 1 , control : 3 , bg : 1 , neighbours : [ 'jordan','iran','gulfstates','saudiarabia' ], region : "mideast" , name : "Iraq" };
    countries['iran'] = { top : 1350, left : 3082, us : 1 , ussr : 0 , control : 2 , bg : 1 , neighbours : [ 'iraq','afghanistan','pakistan' ], region : "mideast" , name : "Iran" };
    countries['jordan'] = { top : 1500, left : 2760, us : 0 , ussr : 0 , control : 2 , bg : 0 , neighbours : [ 'israel','lebanon','iraq','saudiarabia' ], region : "mideast" , name : "Jordan" };
    countries['gulfstates'] = { top : 1500, left : 3010, us : 0 , ussr : 0 , control : 3 , bg : 0 , neighbours : [ 'iraq','saudiarabia' ], region : "mideast" , name : "Gulf States" };
    countries['saudiarabia'] = { top : 1650, left : 2950, us : 0 , ussr : 0 , control : 3 , bg : 1 , neighbours : [ 'jordan','iraq','gulfstates' ], region : "mideast" , name : "Saudi Arabia" };


    // ASIA
    countries['afghanistan'] = { top : 1250, left : 3345, us : 0 , ussr : 0 , control : 2 , bg : 0 , neighbours : [ 'iran','pakistan' ], region : "asia" , name : "Afghanistan" };
    countries['pakistan'] = { top : 1450, left : 3345, us : 0 , ussr : 0 , control : 2 , bg : 1 , neighbours : [ 'iran','afghanistan','india' ], region : "asia" , name : "Pakistan"}
    countries['india'] = { top : 1552, left : 3585, us : 0 , ussr : 0 , control : 3 , bg : 1 , neighbours : [ 'pakistan','burma' ], region : "asia" , name : "India"};
    countries['burma'] = { top : 1580, left : 3855, us : 0 , ussr : 0 , control : 2 , bg : 0 , neighbours : [ 'india','laos' ], region : "seasia" , name : "Burma"};
    countries['laos'] = { top : 1600, left : 4070, us : 0 , ussr : 0 , control : 1 , bg : 0 , neighbours : [ 'burma','thailand','vietnam' ], region : "seasia" , name : "Laos"};
    countries['thailand'] = { top : 1769, left : 3980, us : 0 , ussr : 0 , control : 2 , bg : 1 , neighbours : [ 'laos','vietnam','malaysia' ], region : "seasia" , name : "Thailand"};
    countries['vietnam'] = { top : 1760, left : 4200, us : 0 , ussr : 0 , control : 1 , bg : 0 , neighbours : [ 'laos','thailand' ], region : "seasia" , name : "Vietnam"};
    countries['malaysia'] = { top : 1990, left : 4080, us : 0 , ussr : 0 , control : 2 , bg : 0 , neighbours : [ 'thailand','australia','indonesia' ], region : "seasia" , name : "Malaysia"};
    countries['australia'] = { top : 2442, left : 4450, us : 4 , ussr : 0 , control : 4 , bg : 0 , neighbours : [ 'malaysia' ], region : "asia" , name : "Australia" };
    countries['indonesia'] = { top : 2176, left : 4450, us : 0 , ussr : 0 , control : 1 , bg : 0 , neighbours : [ 'malaysia','philippines' ], region : "seasia" , name : "Indonesia"};
    countries['philippines'] = { top : 1755, left : 4530, us : 1 , ussr : 0 , control : 2 , bg : 0 , neighbours : [ 'indonesia','japan' ], region : "seasia" , name : "Philippines"};
    countries['taiwan'] = { top : 1525, left : 4435, us : 0 , ussr : 0 , control : 3 , bg : 0 , neighbours : [ 'japan','southkorea' ], region : "asia" , name : "Taiwan"};
    countries['japan'] = { top : 1348, left : 4705, us : 1 , ussr : 0 , control : 4 , bg : 1 , neighbours : [ 'philippines','taiwan','southkorea' ], region : "asia" , name : "Japan"};
    countries['southkorea'] = { top : 1200, left : 4530, us : 1 , ussr : 0 , control : 3 , bg : 1 , neighbours : [ 'japan','taiwan','northkorea' ], region : "asia" , name : "South Korea"};
    countries['northkorea'] = { top : 1050, left : 4480, us : 0 , ussr : 3 , control : 3 , bg : 1 , neighbours : [ 'southkorea' ], region : "asia" , name : "North Korea"};



    // CENTRAL AMERICA
    countries['mexico'] = { top : 1370, left : 175, us : 0 , ussr : 0 , control : 2 , bg : 1 , neighbours : [ 'guatemala' ], region : "camerica" , name : "Mexico"};
    countries['guatemala'] = { top : 1526, left : 360, us : 0 , ussr : 0 , control : 1 , bg : 0 , neighbours : [ 'mexico','elsalvador','honduras' ], region : "camerica" , name : "Guatemala"};
    countries['elsalvador'] = { top : 1690, left : 295, us : 0 , ussr : 0 , control : 1 , bg : 0 , neighbours : [ 'honduras','guatemala' ], region : "camerica" , name : "El Salvador"};
    countries['honduras'] = { top : 1675, left : 515, us : 0 , ussr : 0 , control : 2 , bg : 0 , neighbours : [ 'nicaragua','costarica','guatemala','elsalvador' ], region : "camerica" , name : "Honduras"};
    countries['nicaragua'] = { top : 1675, left : 735, us : 0 , ussr : 0 , control : 1 , bg : 0 , neighbours : [ 'costarica','honduras','cuba' ], region : "camerica" , name : "Nicaragua"};
    countries['costarica'] = { top : 1830, left : 495, us : 0 , ussr : 0 , control : 3 , bg : 0 , neighbours : [ 'honduras', 'panama','nicaragua' ], region : "camerica" , name : "Costa Rica"};
    countries['panama'] = { top : 1830, left : 738, us : 1 , ussr : 0 , control : 2 , bg : 1 , neighbours : [ 'colombia','costarica' ], region : "camerica" , name : "Panama"};
    countries['cuba'] = { top : 1480, left : 750, us : 0 , ussr : 0 , control : 3 , bg : 1 , neighbours : [ 'haiti','nicaragua' ], region : "camerica" , name : "Cuba"};
    countries['haiti'] = { top : 1620, left : 970, us : 0 , ussr : 0 , control : 1 , bg : 0 , neighbours : [ 'cuba','dominicanrepublic' ], region : "camerica" , name : "Haiti"};
    countries['dominicanrepublic'] = { top : 1620, left : 1180, us : 0 , ussr : 0 , control : 1 , bg : 0 , neighbours : [ 'haiti' ], region : "camerica" , name : "Dominican Republic"};

    // SOUTH AMERICA
    countries['venezuela'] = { top : 1850, left : 1000, us : 0 , ussr : 0 , control : 2 , bg : 1 , neighbours : [ 'colombia','brazil' ], region : "samerica" , name : "Venezuela"};
    countries['colombia'] = { top : 2010, left : 878, us : 0 , ussr : 0 , control : 1 , bg : 0 , neighbours : [ 'panama','venezuela','ecuador' ], region : "samerica" , name : "Colombia"};
    countries['ecuador'] = { top : 2075, left : 650, us : 0 , ussr : 0 , control : 2 , bg : 0 , neighbours : [ 'peru','colombia' ], region : "samerica" , name : "Ecuador"};
    countries['peru'] = { top : 2244, left : 780, us : 0 , ussr : 0 , control : 2 , bg : 0 , neighbours : [ 'ecuador','chile','bolivia' ], region : "samerica" , name : "Peru"};
    countries['chile'] = { top : 2570, left : 885, us : 0 , ussr : 0 , control : 3 , bg : 1 , neighbours : [ 'peru','argentina' ], region : "samerica" , name : "Chile"};
    countries['bolivia'] = { top : 2385, left : 1005, us : 0 , ussr : 0 , control : 2 , bg : 0 , neighbours : [ 'paraguay','peru' ], region : "samerica" , name : "Bolivia"};
    countries['argentina'] = { top : 2860, left : 955, us : 0 , ussr : 0 , control : 2 , bg : 1 , neighbours : [ 'chile','uruguay','paraguay' ], region : "samerica" , name : "Argentina"};
    countries['paraguay'] = { top : 2550, left : 1130, us : 0 , ussr : 0 , control : 2 , bg : 0 , neighbours : [ 'uruguay','argentina','bolivia' ], region : "samerica" , name : "Paraguay"};
    countries['uruguay'] = { top : 2740, left : 1200, us : 0 , ussr : 0 , control : 2 , bg : 0 , neighbours : [ 'argentina','paraguay','brazil' ], region : "samerica" , name : "Uruguay"};
    countries['brazil'] = { top : 2230, left : 1385, us : 0 , ussr : 0 , control : 2 , bg : 1 , neighbours : [ 'uruguay','venezuela' ], region : "samerica" , name : "Brazil"};

    // AFRICA
    countries['morocco'] = { top : 1400, left : 1710, us : 0 , ussr : 0 , control : 3 , bg : 0 , neighbours : [ 'westafricanstates','algeria','spain' ], region : "africa" , name : "Morocco"};
    countries['algeria'] = { top : 1330, left : 1935, us : 0 , ussr : 0 , control : 2 , bg : 1 , neighbours : [ 'tunisia','morocco','france','saharanstates' ], region : "africa" , name : "Algeria"};
    countries['tunisia'] = { top : 1310, left : 2160, us : 0 , ussr : 0 , control : 2 , bg : 0 , neighbours : [ 'libya','algeria' ], region : "africa" , name : "Tunisia"};
    countries['westafricanstates'] = { top : 1595, left : 1690, us : 0 , ussr : 0 , control : 2 , bg : 0 , neighbours : [ 'ivorycoast','morocco' ], region : "africa" , name : "West African States"};
    countries['saharanstates'] = { top : 1650, left : 2025, us : 0 , ussr : 0 , control : 1 , bg : 0 , neighbours : [ 'algeria','nigeria' ], region : "africa" , name : "Saharan States"};
    countries['sudan'] = { top : 1690, left : 2550, us : 0 , ussr : 0 , control : 1 , bg : 0 , neighbours : [ 'egypt','ethiopia' ], region : "africa" , name : "Sudan"};
    countries['ivorycoast'] = { top : 1885, left : 1835, us : 0 , ussr : 0 , control : 2 , bg : 0 , neighbours : [ 'nigeria','westafricanstates' ], region : "africa" , name : "Ivory Coast"};
    countries['nigeria'] = { top : 1859, left : 2110, us : 0 , ussr : 0 , control : 1 , bg : 1 , neighbours : [ 'ivorycoast','cameroon','saharanstates' ], region : "africa" , name : "Nigeria"};
    countries['ethiopia'] = { top : 1845, left : 2710, us : 0 , ussr : 0 , control : 1 , bg : 0 , neighbours : [ 'sudan','somalia' ], region : "africa" , name : "Ethiopia"};
    countries['somalia'] = { top : 1910, left : 2955, us : 0 , ussr : 0 , control : 2 , bg : 0 , neighbours : [ 'ethiopia','kenya' ], region : "africa" , name : "Somalia"};
    countries['cameroon'] = { top : 2035, left : 2210, us : 0 , ussr : 0 , control : 1 , bg : 0 , neighbours : [ 'zaire','nigeria' ], region : "africa" , name : "Cameroon"};
    countries['zaire'] = { top : 2110, left : 2470, us : 0 , ussr : 0 , control : 1 , bg : 1 , neighbours : [ 'angola','zimbabwe','cameroon' ], region : "africa" , name : "Zaire"};
    countries['kenya'] = { top : 2045, left : 2735, us : 0 , ussr : 0 , control : 2 , bg : 0 , neighbours : [ 'seafricanstates','somalia' ], region : "africa" , name : "Kenya"};
    countries['angola'] = { top : 2290, left : 2280, us : 0 , ussr : 0 , control : 1 , bg : 1 , neighbours : [ 'southafrica','botswana','zaire' ], region : "africa" , name : "Angola"};
    countries['seafricanstates'] = { top : 2250, left : 2760, us : 0 , ussr : 0 , control : 1 , bg : 0 , neighbours : [ 'zimbabwe','kenya' ], region : "africa" , name : "Southeast African States"};
    countries['zimbabwe'] = { top : 2365, left : 2545, us : 0 , ussr : 0 , control : 1 , bg : 0 , neighbours : [ 'seafricanstates','botswana','zaire' ], region : "africa" , name : "Zimbabwe"};
    countries['botswana'] = { top : 2520, left : 2475, us : 0 , ussr : 0 , control : 2 , bg : 0 , neighbours : [ 'southafrica','angola','zimbabwe' ], region : "africa" , name : "Botswana"};
    countries['southafrica'] = { top : 2690, left : 2370, us : 1 , ussr : 0 , control : 3 , bg : 1 , neighbours : [ 'angola','botswana' ], region : "africa" , name : "South Africa"};

    for (var i in countries) { countries[i].place = 0; }

    return countries;

  }



  returnChinaCard() {
    return { img : "TNRnTS-06" , name : "China" , scoring : 0 , bg : 0 , player : "both" , recurring : 1 , ops : 4 };
  }



  returnEarlyWarCards() {

    var deck = {};

    // EARLY WAR
    deck['asia']            = { img : "TNRnTS-01" , name : "Asia Scoring", scoring : 1 , player : "both" , recurring : 1 , ops : 0 };
    deck['europe']          = { img : "TNRnTS-02" , name : "Europe Scoring", scoring : 1 , player : "both" , recurring : 1 , ops : 0 };
    deck['mideast']         = { img : "TNRnTS-03" , name : "Middle-East Scoring", scoring : 1 , player : "both" , recurring : 1 , ops : 0 };
    deck['duckandcover']    = { img : "TNRnTS-04" , name : "Duck and Cover", scoring : 0 , player : "us"   , recurring : 1 , ops : 3 };
    deck['fiveyearplan']    = { img : "TNRnTS-05" , name : "Five Year Plan", scoring : 0 , player : "us"   , recurring : 1 , ops : 3 };
    deck['socgov']          = { img : "TNRnTS-07" , name : "Socialist Governments", scoring : 0 , player : "ussr" , recurring : 1 , ops : 3 };
    deck['fidel']           = { img : "TNRnTS-08" , name : "Fidel", scoring : 0 , player : "ussr" , recurring : 0 , ops : 2 };
    deck['vietnamrevolts']  = { img : "TNRnTS-09" , name : "Vietnam Revolts", scoring : 0 , player : "ussr" , recurring : 0 , ops : 2 };
    deck['blockade']        = { img : "TNRnTS-10" , name : "Blockade", scoring : 0 , player : "ussr" , recurring : 0 , ops : 1 };
    deck['koreanwar']       = { img : "TNRnTS-11" , name : "Korean War", scoring : 0 , player : "ussr" , recurring : 0 , ops : 2 };
    deck['romanianab']      = { img : "TNRnTS-12" , name : "Romanian Abdication", scoring : 0 , player : "ussr" , recurring : 0 , ops : 1 };
    deck['arabisraeli']     = { img : "TNRnTS-13" , name : "Arab-Israeli War", scoring : 0 , player : "ussr" , recurring : 1 , ops : 2 };
    deck['comecon']         = { img : "TNRnTS-14" , name : "Comecon", scoring : 0 , player : "ussr" , recurring : 0 , ops : 3 };
    deck['nasser']          = { img : "TNRnTS-15" , name : "Nasser", scoring : 0 , player : "ussr" , recurring : 0 , ops : 1 };
    deck['warsawpact']      = { img : "TNRnTS-16" , name : "Warsaw Pact", scoring : 0 , player : "ussr" , recurring : 0 , ops : 3 };
    deck['degaulle']        = { img : "TNRnTS-17" , name : "De Gaulle Leads France", scoring : 0 , player : "ussr" , recurring : 0 , ops : 3 };
    deck['naziscientist']   = { img : "TNRnTS-18" , name : "Nazi Scientist", scoring : 0 , player : "both" , recurring : 0 , ops : 1 };
    deck['truman']          = { img : "TNRnTS-19" , name : "Truman", scoring : 0 , player : "us"   , recurring : 0 , ops : 1 };
    deck['olympic']         = { img : "TNRnTS-20" , name : "Olympic Games", scoring : 0 , player : "both" , recurring : 1 , ops : 2 };
    deck['nato']            = { img : "TNRnTS-21" , name : "NATO", scoring : 0 , player : "us"   , recurring : 0 , ops : 4 };
    deck['indreds']         = { img : "TNRnTS-22" , name : "Independent Reds", scoring : 0 , player : "us"   , recurring : 0 , ops : 2 };
    deck['marshall']        = { img : "TNRnTS-23" , name : "Marshall Plan", scoring : 0 , player : "us"   , recurring : 0 , ops : 4 };
    deck['indopaki']        = { img : "TNRnTS-24" , name : "Indo-Pakistani War", scoring : 0 , player : "both" , recurring : 1 , ops : 2 };
    deck['containment']     = { img : "TNRnTS-25" , name : "Containment", scoring : 0 , player : "us"   , recurring : 0 , ops : 3 };
    deck['cia']             = { img : "TNRnTS-26" , name : "CIA Created", scoring : 0 , player : "us"   , recurring : 0 , ops : 1 };
    deck['usjapan']         = { img : "TNRnTS-27" , name : "US/Japan Defense Pact", scoring : 0 , player : "us"   , recurring : 0 , ops : 4 };
    deck['suezcrisis']      = { img : "TNRnTS-28" , name : "Suez Crisis", scoring : 0 , player : "ussr" , recurring : 0 , ops : 3 };
    deck['easteuropean']    = { img : "TNRnTS-29" , name : "East European Unrest", scoring : 0 , player : "us"   , recurring : 1 , ops : 3 };
    deck['decolonization']  = { img : "TNRnTS-30" , name : "Decolonization", scoring : 0 , player : "ussr" , recurring : 1 , ops : 2 };
    deck['redscare']        = { img : "TNRnTS-31" , name : "Red Scare", scoring : 0 , player : "both" , recurring : 1 , ops : 4 };
    deck['unintervention']  = { img : "TNRnTS-32" , name : "UN Intervention", scoring : 0 , player : "both" , recurring : 1 , ops : 1 };
    deck['destalinization'] = { img : "TNRnTS-33" , name : "Destalinization", scoring : 0 , player : "ussr" , recurring : 0 , ops : 3 };
    deck['nucleartestban']  = { img : "TNRnTS-34" , name : "Nuclear Test Ban Treaty", scoring : 0 , player : "both" , recurring : 1 , ops : 4 };
    deck['formosan']        = { img : "TNRnTS-35" , name : "Formosan Resolution", scoring : 0 , player : "us"   , recurring : 0 , ops : 2 };

    //
    // OPTIONS - we default to the expanded deck
    //
    if (this.game.options.deck != "original" ) {
      deck['defectors']       = { img : "TNRnTS-103" ,name : "Defectors", scoring : 0 , player : "us"   , recurring : 1 , ops : 2 };
      deck['cambridge']       = { img : "TNRnTS-104" ,name : "The Cambridge Five", scoring : 0 , player : "ussr"   , recurring : 1 , ops : 2 };
      deck['specialrelation'] = { img : "TNRnTS-105" ,name : "Special Relationship", scoring : 0 , player : "us"   , recurring : 1 , ops : 2 };
      deck['norad']           = { img : "TNRnTS-106" ,name : "NORAD", scoring : 0 , player : "us"   , recurring : 0 , ops : 3 };
    }
    
    //
    // remove or add specified cards
    //
    if (this.game.options != undefined) {
      for (var key in this.game.options) {

        if (deck[key] != undefined) { delete deck[key]; }

        //
        // optional early war cards
        //
        if (key === "culturaldiplomacy") { deck['culturaldiplomacy'] = { img : "TNRnTS-202png" , name : "Cultural Diplomacy", scoring : 0 , player : "both" , recurring : 1 , ops : 2 }; }
        if (key === "gouzenkoaffair") { deck['gouzenkoaffair'] = { img : "TNRnTS-204png" , name : "Gouzenko Affair", scoring : 0 , player : "ussr" , recurring : 0 , ops : 2 }; }
        if (key === "poliovaccine") { deck['poliovaccine'] = { img : "TNRnTS-206png" , name : "Polio Vaccine", scoring : 0 , player : "both" , recurring : 0 , ops : 3 }; }

	      // END OF HISTORY
        if (key === "peronism") { deck['peronism']       = { img : "TNRnTS-307png" ,name : "Peronism", scoring : 0 , player : "both"   , recurring : 0 , ops : 1 }; }


	      // COLD WAR CRAZIES 
        if (key === "berlinairlift") { deck['berlinairlift']      	= { img : "TNRnTS-401png" ,name : "Berlin Airlift", scoring : 0 , player : "us"     , recurring : 0 , ops : 1 }; }
        if (key === "communistrevolution") { deck['communistrevolution']       = { img : "TNRnTS-402png" ,name : "Communist Revolution", scoring : 0 , player : "ussr"   , recurring : 1 , ops : 2 }; }
        if (key === "philadelphia") { deck['philadelphia']      	= { img : "TNRnTS-403png" ,name : "Philadelphia Experiment", scoring : 0 , player : "us"     , recurring : 0 , ops : 3 }; }
        if (key === "sinoindian") { deck['sinoindian']                = { img : "TNRnTS-404png" ,name : "Sino-Indian War", scoring : 0 , player : "both"   , recurring : 1 , ops : 2 }; }
        if (key === "titostalin") { deck['titostalin']                = { img : "TNRnTS-405png" ,name : "Tito-Stalin Split", scoring : 0 , player : "us"   , recurring : 1 , ops : 3 }; }

      }
    }


    //
    // specify early-war period
    //
    for (var key in deck) { deck[key].p = 0; }

    return deck;

  }



  returnMidWarCards() {

    var deck = {};

    deck['brushwar']          = { img : "TNRnTS-36" , name : "Brush War", scoring : 0 , player : "both" , recurring : 1 , ops : 3 };
    deck['camerica']          = { img : "TNRnTS-37" , name : "Central America Scoring", scoring : 1 , player : "both" , recurring : 1 , ops : 0 };
    deck['seasia']            = { img : "TNRnTS-38" , name : "Southeast Asia Scoring", scoring : 1 , player : "both" , recurring : 0 , ops : 0 };
    deck['armsrace']          = { img : "TNRnTS-39" , name : "Arms Race", scoring : 0 , player : "both" , recurring : 1 , ops : 3 };
    deck['cubanmissile']      = { img : "TNRnTS-40" , name : "Cuban Missile Crisis", scoring : 0 , player : "both" , recurring : 0 , ops : 3 };
    deck['nuclearsubs']       = { img : "TNRnTS-41" , name : "Nuclear Subs", scoring : 0 , player : "us" , recurring : 0 , ops : 2 };
    deck['quagmire']          = { img : "TNRnTS-42" , name : "Quagmire", scoring : 0 , player : "ussr" , recurring : 0 , ops : 3 };
    deck['saltnegotiations']  = { img : "TNRnTS-43" , name : "Salt Negotiations", scoring : 0 , player : "both" , recurring : 0 , ops : 3 };
    deck['beartrap']          = { img : "TNRnTS-44" , name : "Bear Trap", scoring : 0 , player : "us" , recurring : 0 , ops : 3 };
    deck['summit']            = { img : "TNRnTS-45" , name : "Summit", scoring : 0 , player : "both" , recurring : 1 , ops : 1 };
    deck['howilearned']       = { img : "TNRnTS-46" , name : "How I Learned to Stop Worrying", scoring : 0 , player : "both" , recurring : 0 , ops : 2 };
    deck['junta']             = { img : "TNRnTS-47" , name : "Junta", scoring : 0 , player : "both" , recurring : 1 , ops : 2 };
    deck['kitchendebates']    = { img : "TNRnTS-48" , name : "Kitchen Debates", scoring : 0 , player : "us" , recurring : 0 , ops : 1 };
    deck['missileenvy']       = { img : "TNRnTS-49" , name : "Missile Envy", scoring : 0 , player : "both" , recurring : 1 , ops : 2 };
    deck['wwby']              = { img : "TNRnTS-50" , name : "We Will Bury You", scoring : 0 , player : "ussr" , recurring : 0 , ops : 4 };
    deck['brezhnev']          = { img : "TNRnTS-51" , name : "Brezhnev Doctrine", scoring : 0 , player : "ussr" , recurring : 0 , ops : 3 };
    deck['portuguese']        = { img : "TNRnTS-52" , name : "Portuguese Empire Crumbles", scoring : 0 , player : "ussr" , recurring : 0 , ops : 2 };
    deck['southafrican']      = { img : "TNRnTS-53" , name : "South African Unrest", scoring : 0 , player : "ussr" , recurring : 1 , ops : 2 };
    deck['allende']           = { img : "TNRnTS-54" , name : "Allende", scoring : 0 , player : "ussr" , recurring : 0 , ops : 1 };
    deck['willybrandt']       = { img : "TNRnTS-55" , name : "Willy Brandt", scoring : 0 , player : "ussr" , recurring : 0 , ops : 2 };
    deck['muslimrevolution']  = { img : "TNRnTS-56" , name : "Muslim Revolution", scoring : 0 , player : "ussr" , recurring : 1 , ops : 4 };
    deck['abmtreaty']         = { img : "TNRnTS-57" , name : "ABM Treaty", scoring : 0 , player : "both" , recurring : 1 , ops : 4 };
    deck['culturalrev']       = { img : "TNRnTS-58" , name : "Cultural Revolution", scoring : 0 , player : "ussr" , recurring : 0 , ops : 3 };
    deck['flowerpower']       = { img : "TNRnTS-59" , name : "Flower Power", scoring : 0 , player : "ussr" , recurring : 0 , ops : 4 };
    deck['u2']                = { img : "TNRnTS-60" , name : "U2 Incident", scoring : 0 , player : "ussr" , recurring : 0 , ops : 3 };
    deck['opec']              = { img : "TNRnTS-61" , name : "OPEC", scoring : 0 , player : "ussr" , recurring : 1 , ops : 3 };
    deck['lonegunman']        = { img : "TNRnTS-62" , name : "Lone Gunman", scoring : 0 , player : "ussr" , recurring : 0 , ops : 1 };
    deck['colonial']          = { img : "TNRnTS-63" , name : "Colonial Rear Guards", scoring : 0 , player : "us" , recurring : 1 , ops : 2 };
    deck['panamacanal']       = { img : "TNRnTS-64" , name : "Panama Canal Returned", scoring : 0 , player : "us" , recurring : 0 , ops : 1 };
    deck['campdavid']         = { img : "TNRnTS-65" , name : "Camp David Accords", scoring : 0 , player : "us" , recurring : 0 , ops : 2 };
    deck['puppet']            = { img : "TNRnTS-66" , name : "Puppet Governments", scoring : 0 , player : "us" , recurring : 0 , ops : 2 };
    deck['grainsales']        = { img : "TNRnTS-67" , name : "Grain Sales to Soviets", scoring : 0 , player : "us" , recurring : 1 , ops : 2 };
    deck['johnpaul']          = { img : "TNRnTS-68" , name : "John Paul II Elected Pope", scoring : 0 , player : "us" , recurring : 0 , ops : 2 };
    deck['deathsquads']       = { img : "TNRnTS-69png" , name : "Latin American Death Squads", scoring : 0 , player : "both" , recurring : 1 , ops : 2 };
    deck['oas']               = { img : "TNRnTS-70" , name : "OAS Founded", scoring : 0 , player : "us" , recurring : 0 , ops : 1 };
    deck['nixon']             = { img : "TNRnTS-71" , name : "Nixon Plays the China Card", scoring : 0 , player : "us" , recurring : 0 , ops : 2 };
    deck['sadat']             = { img : "TNRnTS-72" , name : "Sadat Expels Soviets", scoring : 0 , player : "us" , recurring : 0 , ops : 1 };
    deck['shuttle']           = { img : "TNRnTS-73" , name : "Shuttle Diplomacy", scoring : 0 , player : "us" , recurring : 1 , ops : 3 };
    deck['voiceofamerica']    = { img : "TNRnTS-74" , name : "Voice of America", scoring : 0 , player : "us" , recurring : 1 , ops : 2 };
    deck['liberation']        = { img : "TNRnTS-75" , name : "Liberation Theology", scoring : 0 , player : "ussr" , recurring : 1 , ops : 2 };
    deck['ussuri']            = { img : "TNRnTS-76" , name : "Ussuri River Skirmish", scoring : 0 , player : "us" , recurring : 0 , ops : 3 };
    deck['asknot']            = { img : "TNRnTS-77" , name : "Ask Not What Your Country...", scoring : 0 , player : "us" , recurring : 0 , ops : 3 };
    deck['alliance']          = { img : "TNRnTS-78" , name : "Alliance for Progress", scoring : 0 , player : "us" , recurring : 0 , ops : 3 };
    deck['africa']            = { img : "TNRnTS-79" , name : "Africa Scoring", scoring : 1 , player : "both" , recurring : 1 , ops : 0 };
    deck['onesmallstep']      = { img : "TNRnTS-80" , name : "One Small Step", scoring : 0 , player : "both" , recurring : 1 , ops : 2 };
    deck['samerica']          = { img : "TNRnTS-81" , name : "South America Scoring", scoring : 1 , player : "both" , recurring : 1 , ops : 0 };

    //
    // OPTIONS - we default to the expanded deck
    //
    if (this.game.options.deck != "original" ) {
      deck['che']               = { img : "TNRnTS-107" , name : "Che", scoring : 0 , player : "ussr" , recurring : 1 , ops : 3 };
      deck['tehran']            = { img : "TNRnTS-108" , name : "Our Man in Tehran", scoring : 0 , player : "us" , recurring : 0 , ops : 2 };
    }


    //
    // remove any cards specified
    //
    if (this.game.options != undefined) {
      for (var key in this.game.options) {

        if (deck[key] != undefined) { delete deck[key]; }

        //
        // optional midwar cards
        //
        if (key === "handshake") { deck['handshake'] = { img : "TNRnTS-201png" , name : "Handshake in Space", scoring : 0 , player : "both" , recurring : 1 , ops : 1 }; }
        if (key === "berlinagreement") { deck['berlinagreement'] = { img : "TNRnTS-205png" , name : "Berlin Agreement", scoring : 0 , player : "both" , recurring : 0 , ops : 2 }; }


	// END OF HISTORY
        if (key === "manwhosavedtheworld") { deck['manwhosavedtheworld']       = { img : "TNRnTS-301png" ,name : "The Man Who Saved the World", scoring : 0 , player : "both"   , recurring : 0 , ops : 4 }; }
        if (key === "breakthroughatlopnor") { deck['breakthroughatlopnor']      = { img : "TNRnTS-302png" ,name : "Breakthrough at Lop Nor", scoring : 0 , player : "ussr"   , recurring : 0 , ops : 2 }; }
        if (key === "greatsociety") { deck['greatsociety']              = { img : "TNRnTS-303png" ,name : "Great Society", scoring : 0 , player : "us"   , recurring : 0 , ops : 2 }; }
        if (key === "nationbuilding") { deck['nationbuilding']            = { img : "TNRnTS-304png" ,name : "Nation Building", scoring : 0 , player : "both"   , recurring : 1 , ops : 2 }; }
	if (key === "eurocommunism") { deck['eurocommunism']             = { img : "TNRnTS-306png" ,name : "Eurocommunism", scoring : 0 , player : "us"   , recurring : 0 , ops : 3 }; }


	// ABSURDUM
        if (key === "kissingerisawarcriminal") { deck['kissingerisawarcriminal'] 	     	= { img : "TNRnTS-502png" ,name : "Kissinger Bombs Cambodia", scoring : 0 , player : "us"     , recurring : 1 , ops : 2 }; }


      }
    }

    //
    // specify early-war period
    //
    for (var key in deck) { deck[key].p = 1; }


    return deck;

  }


  returnLateWarCards() {

    var deck = {};

    deck['iranianhostage']    = { img : "TNRnTS-82" , name : "Iranian Hostage Crisis", scoring : 0 , player : "ussr" , recurring : 0 , ops : 3 };
    deck['ironlady']          = { img : "TNRnTS-83" , name : "The Iron Lady", scoring : 0 , player : "us" , recurring : 0 , ops : 3 };
    deck['reagan']            = { img : "TNRnTS-84" , name : "Reagan Bombs Libya", scoring : 0 , player : "us" , recurring : 0 , ops : 2 };
    deck['starwars']          = { img : "TNRnTS-85" , name : "Star Wars", scoring : 0 , player : "us" , recurring : 0 , ops : 2 };
    deck['northseaoil']       = { img : "TNRnTS-86" , name : "North Sea Oil", scoring : 0 , player : "us" , recurring : 0 , ops : 3 };
    deck['reformer']          = { img : "TNRnTS-87" , name : "The Reformer", scoring : 0 , player : "ussr" , recurring : 0 , ops : 3 };
    deck['marine']            = { img : "TNRnTS-88" , name : "Marine Barracks Bombing", scoring : 0 , player : "ussr" , recurring : 0 , ops : 2 };
    deck['KAL007']            = { img : "TNRnTS-89" , name : "Soviets Shoot Down KAL-007", scoring : 0 , player : "us" , recurring : 0 , ops : 4 };
    deck['glasnost']          = { img : "TNRnTS-90" , name : "Glasnost", scoring : 0 , player : "ussr" , recurring : 0 , ops : 4 };
    deck['ortega']            = { img : "TNRnTS-91" , name : "Ortega Elected in Nicaragua", scoring : 0 , player : "ussr" , recurring : 0 , ops : 2 };
    deck['terrorism']         = { img : "TNRnTS-92" , name : "Terrorism", scoring : 0 , player : "both" , recurring : 1 , ops : 2 };
    deck['irancontra']        = { img : "TNRnTS-93" , name : "Iran Contra Scandal", scoring : 0 , player : "ussr" , recurring : 0 , ops : 2 };
    deck['chernobyl']         = { img : "TNRnTS-94" , name : "Chernobyl", scoring : 0 , player : "us" , recurring : 0 , ops : 3 };
    deck['debtcrisis']        = { img : "TNRnTS-95" , name : "Latin American Debt Crisis", scoring : 0 , player : "ussr" , recurring : 1 , ops : 2 };
    deck['teardown']          = { img : "TNRnTS-96" , name : "Tear Down this Wall", scoring : 0 , player : "us" , recurring : 0 , ops : 3 };
    deck['evilempire']        = { img : "TNRnTS-97" , name : "An Evil Empire", scoring : 0 , player : "us" , recurring : 0 , ops : 3 };
    deck['aldrichames']       = { img : "TNRnTS-98" , name : "Aldrich Ames Remix", scoring : 0 , player : "ussr" , recurring : 0 , ops : 3 };
    deck['pershing']          = { img : "TNRnTS-99" , name : "Pershing II Deployed", scoring : 0 , player : "ussr" , recurring : 0 , ops : 3 };
    deck['wargames']          = { img : "TNRnTS-100" , name : "Wargames", scoring : 0 , player : "both" , recurring : 0 , ops : 4 };
    deck['solidarity']        = { img : "TNRnTS-101" , name : "Solidarity", scoring : 0 , player : "us" , recurring : 0 , ops : 2 };

    //
    // OPTIONS - we default to the expanded deck
    //
    if (this.game.options.deck != "original" ) {
      deck['iraniraq']          = { img : "TNRnTS-102" , name : "Iran-Iraq War", scoring : 0 , player : "both" , recurring : 0 , ops : 2 };
      deck['yuri']              = { img : "TNRnTS-109" , name : "Yuri and Samantha", scoring : 0 , player : "ussr" , recurring : 0 , ops : 2 };
      deck['awacs']             = { img : "TNRnTS-110" , name : "AWACS Sale to Saudis", scoring : 0 , player : "us" , recurring : 0 , ops : 3 };
    }

    //
    // remove any cards specified
    //
    if (this.game.options != undefined) {
      for (var key in this.game.options) {

        if (deck[key] != undefined) { delete deck[key]; }

        //
        // optional latewar cards
        //
        if (key === "rustinredsquare") { deck['rustinredsquare'] = { img : "TNRnTS-203png" , name : "Rust Lands in Red Square", scoring : 0 , player : "us" , recurring : 0 , ops : 1 }; }

        // END OF HISTORY
        if (key === "perestroika") { deck['perestroika']       = { img : "TNRnTS-305png" ,name : "Perestroika", scoring : 0 , player : "ussr"   , recurring : 0 , ops : 3 }; }
        if (key === "inftreaty") { deck['inftreaty']         = { img : "TNRnTS-308png" ,name : "INF Treaty", scoring : 0 , player : "both"   , recurring : 0 , ops : 3 }; }

        // COLD WAR CRAZIES
        if (key === "sovietcoup") { deck['sovietcoup']       = { img : "TNRnTS-405png" ,name : "Soviet Coup", scoring : 0 , player : "ussr"   , recurring : 0 , ops : 4 }; }    

        // TWILIGHT ABSURDUM
        if (key === "brexit") { deck['brexit'] 	     	= { img : "TNRnTS-501png" ,name : "Brexit", scoring : 0 , player : "both"     , recurring : 1 , ops : 4 }; }

      }
    }


    //
    // specify early-war period
    //
    for (var key in deck) { deck[key].p = 2; }

    return deck;

  }



  returnUnplayedCards() {

    var unplayed = {};
    for (let i in this.game.deck[0].cards) {
      unplayed[i] = this.game.deck[0].cards[i];
    }
    for (let i in this.game.deck[0].discards) {
      delete unplayed[i];
    }
    for (let i in this.game.deck[0].removed) {
      delete unplayed[i];
    }
    for (let i = 0; i < this.game.deck[0].hand.length; i++) {
      delete unplayed[this.game.deck[0].hand[i]];
    }

    return unplayed;

  }




  

  whoControls(country){
    let cobj = this.countries[country]; 
    if (!cobj){
      return "";
    }
    if ((cobj.ussr - cobj.us) >= cobj.control){
      return "ussr";
    }
    if ((cobj.us - cobj.ussr) >= cobj.control){
      return "us";
    }
    return "";
  }

  isControlled(player, country) {

    if (this.countries[country] == undefined) { return 0; }

    let country_lead = 0;

    if (player == "ussr") {
      country_lead = parseInt(this.countries[country].ussr) - parseInt(this.countries[country].us);
    }
    if (player == "us") {
      country_lead = parseInt(this.countries[country].us) - parseInt(this.countries[country].ussr);
    }

    if (this.countries[country].control <= country_lead) { return 1; }
    return 0;

  }



  returnOpsOfCard(card="", deck=0) {
    if (this.game.deck[deck].cards[card] != undefined) {
      return this.game.deck[deck].cards[card].ops;
    }
    if (this.game.deck[deck].discards[card] != undefined) {
      return this.game.deck[deck].discards[card].ops;
    }
    if (this.game.deck[deck].removed[card] != undefined) {
      return this.game.deck[deck].removed[card].ops;
    }
    if (card == "china") { return 4; }
    return 1;
  }


  returnArrayOfRegionBonuses(card="") {

    let regions = [];

    //
    // Vietnam Revolts
    //
    if (this.game.state.events.vietnam_revolts == 1 && this.game.state.events.vietnam_revolts_eligible == 1 && this.game.player == 1) {

      //
      // Vietnam Revolts does not give bonus to 1 OP card in SEA if USSR Red Purged
      // https://boardgamegeek.com/thread/1136951/red-scarepurge-and-vietnam-revolts
      let pushme = 1;
      if (card != "") {
        if (this.game.state.events.redscare_player1 >= 1) {
          if (this.returnOpsOfCard(card) == 1) { pushme = 0; }
        }
      }
      if (pushme == 1) {
        regions.push("seasia");
      }
    }

    //
    // The China Card
    //
    if (this.game.state.events.china_card_in_play == 1 && this.game.state.events.china_card_eligible == 1) {
      regions.push("asia");
    }

    return regions;

  }





  isRegionBonus(card="") {

    //
    // Vietnam Revolts
    //
    if (this.game.state.events.vietnam_revolts == 1 && this.game.state.events.vietnam_revolts_eligible == 1 && this.game.player == 1) {
      //
      // Vietnam Revolts does not give bonus to 1 OP card in SEA if USSR Red Purged
      // https://boardgamegeek.com/thread/1136951/red-scarepurge-and-vietnam-revolts
      if (card != "") { if (this.returnOpsOfCard(card) == 1 && this.game.state.events.redscare_player1 >= 1) { return 0; } }

      this.updateStatus("<div class='status-message' id='status-message'>Extra 1 OP Available for Southeast Asia</div>");
      this.game.state.events.region_bonus = "seasia";
      return 1;
    }

    //
    // The China Card
    //
    if (this.game.state.events.china_card_in_play == 1 && this.game.state.events.china_card_eligible == 1) {

      this.updateStatus("<div class='status-message' id='status-message'>Extra 1 OP Available for Asia</div>");
      this.game.state.events.region_bonus = "asia";
      return 1;
    }
    return 0;
  }




  endRegionBonus() {
    if (this.game.state.events.vietnam_revolts_eligible == 1 && this.game.state.events.vietnam_revolts == 1) {
      this.game.state.events.vietnam_revolts_eligible = 0;
      return;
    }
    if (this.game.state.events.china_card_in_play == 1 && this.game.state.events.china_card_eligible == 1) {
      this.game.state.events.china_card_eligible = 0;
      return;
    }
  }



  limitToRegionBonus() {
    for (var i in this.countries) {
      if (this.countries[i].region.indexOf(this.game.state.events.region_bonus) == -1) {
        let divname = '#'+i;
        $(divname).off();
      } else {

        //Go ahead an remove opponent controlled countries if we don't have both in favor        
        if (this.game.state.events.region_bonus == "asia" || this.game.state.events.china_card_in_play == 0) {
          if (this.game.player == 1) {
            // prevent breaking control
            if (this.isControlled("us", i) == 1) {
              let divname = '#'+i;
              $(divname).off();
            }
          } else {
            // prevent breaking control
            if (this.isControlled("ussr", i) == 1) {
              let divname = '#'+i;
              $(divname).off();
            }
          }
        }
      }

    }
    return;
  }


  /*
   Check various states that affect player's operation points values
  */
  modifyOps(ops, card="",player="", updatelog=1) {

    /* Do we really want to always override the ops passed in??*/
    if (card == "olympic" && ops == 4) {} else {
      if (card != "") { ops = this.returnOpsOfCard(card); }
    }

    if (this.game.state.events.brezhnev == 1 && player === "ussr") {
      if (updatelog == 1) { this.updateLog("USSR gets Brezhnev bonus +1");  }
      ops++;
    }

    if (this.game.state.events.containment == 1 && player === "us") {
      if (updatelog == 1) { this.updateLog("US gets Containment bonus +1");  }
      ops++;
    }

    if (player === "") {
      if (this.game.player = 1) { player = "ussr"; }
      if (this.game.player = 2) { player = "us"; }
    }

    if (this.game.state.events.redscare_player1 >= 1 && player === "ussr") {
      if (updatelog == 1) {
        if (this.game.state.events.redscare_player1 == 1) {
          this.updateLog("USSR is affected by Red Purge");
        } else {
          this.updateLog("USSR is really affected by Red Purge");
        }
      }
      ops -= this.game.state.events.redscare_player1;
    }

    if (this.game.state.events.redscare_player2 >= 1 && player === "us") {
      if (updatelog == 1) {
        if (this.game.state.events.redscare_player2 == 1) {
          this.updateLog("US is affected by Red Scare");
        } else {
          this.updateLog("US is really affected by Red Scare");
        }
      }
      ops -= this.game.state.events.redscare_player2;
    }
    
    if (ops <= 0) { return 1; }
    if (ops >= 4) { return 4; }
    
    return ops;
  }



  finalScoring() {

    //
    // disable shuttle diplomacy
    //
    this.game.state.events.shuttlediplomacy = 0;

    //
    //
    //
    if (this.whoHasTheChinaCard() == "ussr") {
      this.game.state.vp--;
      this.updateLog("USSR receives 1 VP for the China Card");
      if (this.game.state.vp <= -20) {
        this.endGame(this.game.players[0], "victory points");
        return;
      }
    } else {
      this.game.state.vp++;
      this.updateLog("US receives 1 VP for the China Card");
      if (this.game.state.vp >= 20) {
        this.endGame(this.game.players[1], "victory points");
        return;
      }
    }


    let vp_adjustment = 0;
    let total_vp = 0;

    vp_adjustment = this.calculateScoring("europe");
    total_vp = vp_adjustment.us.vp - vp_adjustment.ussr.vp;
    this.game.state.vp += total_vp;
    this.updateLog("Europe: " + total_vp + " VP");
 
    vp_adjustment = this.calculateScoring("asia");
    total_vp = vp_adjustment.us.vp - vp_adjustment.ussr.vp;
    this.game.state.vp += total_vp;
    this.updateLog("Asia: " + total_vp + " VP");

    vp_adjustment = this.calculateScoring("mideast");
    total_vp = vp_adjustment.us.vp - vp_adjustment.ussr.vp;
    this.game.state.vp += total_vp;
    this.updateLog("Middle East: " + total_vp + " VP");

    vp_adjustment = this.calculateScoring("africa");
    total_vp = vp_adjustment.us.vp - vp_adjustment.ussr.vp;
    this.game.state.vp += total_vp;
    this.updateLog("Africa: " + total_vp + " VP");

    vp_adjustment = this.calculateScoring("samerica");
    total_vp = vp_adjustment.us.vp - vp_adjustment.ussr.vp;
    this.game.state.vp += total_vp;
    this.updateLog("South America: " + total_vp + " VP");

    vp_adjustment = this.calculateScoring("camerica");
    total_vp = vp_adjustment.us.vp - vp_adjustment.ussr.vp;
    this.game.state.vp += total_vp;
    this.updateLog("Central America: " + total_vp + " VP");

    this.updateVictoryPoints();

    if (this.game.state.vp == 0) {
      this.tieGame();
      return 1;
    }
    if (this.game.state.vp < 0) {
      this.endGame(this.game.players[0], "final scoring");
    } else {
      this.endGame(this.game.players[1], "final scoring");
    }

    return 1;
  }



  calculateControlledBattlegroundCountries(scoring, bg_countries) {
    for (var [player, side] of Object.entries(scoring)) {
      for (var country of bg_countries) {
        if (this.isControlled(player, country) == 1) { side.bg++; side.total++;}
      }
    }
    return scoring;
  }

  calculateControlledCountries(scoring, countries) {
    for (var [player, side] of Object.entries(scoring)) {
      for (var country of countries) {
        if (this.isControlled(player, country) == 1) { side.total++; };
      }
    }
    return scoring;
  }

  determineRegionVictor(scoring, region_scoring_range, max_bg_num) {

    if (scoring.us.bg == max_bg_num && scoring.us.total > scoring.ussr.total) { 
      scoring.us.vp = region_scoring_range.control; 
      scoring.us.status = "Control";
    }else if (scoring.us.bg > scoring.ussr.bg  && scoring.us.total > scoring.ussr.total && scoring.us.total > scoring.us.bg) { 
      scoring.us.vp = region_scoring_range.domination; 
      scoring.us.status = "Domination";
    }else if (scoring.us.total + scoring.us.bg > 0) { 
      scoring.us.vp = region_scoring_range.presence; 
      scoring.us.status = "Presence";
    }else{
      scoring.us.status = "None";
    }

    if (scoring.ussr.bg == max_bg_num && scoring.ussr.total > scoring.us.total) { 
      scoring.ussr.vp = region_scoring_range.control;
      scoring.ussr.status = "Control"; 
    }else if (scoring.ussr.bg > scoring.us.bg && scoring.ussr.total > scoring.us.total && scoring.ussr.total > scoring.ussr.bg) { 
      scoring.ussr.vp = region_scoring_range.domination; 
      scoring.ussr.status = "Domination";
    }else if (scoring.ussr.total + scoring.ussr.bg > 0) { 
      scoring.ussr.vp = region_scoring_range.presence; 
      scoring.ussr.status = "Presence";
    }else{
      scoring.ussr.status = "None";
    }

    scoring.us.vp = scoring.us.vp + scoring.us.bg;
    scoring.ussr.vp = scoring.ussr.vp + scoring.ussr.bg;

    return scoring;
  }


  calculateScoring(region, mouseover_preview=0) {

    var scoring = {
      us: {total: 0, bg: 0, vp: 0},
      ussr: {total: 0, bg: 0, vp: 0},
    }

    let bg_countries = [];
    let non_bg_countries = [];
    let scoring_range = {presence: 0, domination: 0, control: 0};

    for (let i in this.countries) {
      if (this.countries[i].region.includes(region)) {
        if (this.countries[i].bg === 1) {
          bg_countries.push(i);
        } else {
          non_bg_countries.push(i);
        }
      }
    }

    // skip for SEASIA (special case)
    if (region !== "seasia") {
      scoring = this.calculateControlledBattlegroundCountries(scoring, bg_countries); //fill in scoring.us/ussr.bg
      scoring = this.calculateControlledCountries(scoring, non_bg_countries);         //fill in scoring.us/ussr.total
    }


    switch (region) {

      ////////////
      // EUROPE //
      ////////////
      case "europe":

        scoring_range = {presence: 3, domination: 7, control: 10000 };
        scoring = this.determineRegionVictor(scoring, scoring_range, bg_countries.length);

        //
        // neighbouring countries
        //
        scoring.us.neigh = [];
        scoring.ussr.neigh = [];

        if (this.isControlled("us", "finland") == 1) { scoring.us.vp++; scoring.us.neigh.push("finland");}
        if (this.isControlled("us", "romania") == 1) { scoring.us.vp++; scoring.us.neigh.push("romania");}
        if (this.isControlled("us", "poland") == 1) { scoring.us.vp++; scoring.us.neigh.push("poland"); }
        if (this.isControlled("ussr", "canada") == 1) { scoring.ussr.vp++; scoring.ussr.neigh.push("canada");}

        //
        // GOUZENKO AFFAIR -- early war optional
        //
        if (this.game.state.events.optional.gouzenkoaffair == 1) {
          if (this.isControlled("us", "canada") == 1) { vp_us++; scoring.us.neigh.push("canada");}
        }

        break;

      /////////////
      // MIDEAST //
      /////////////
      case "mideast":
        
        scoring_range = { presence: 3, domination: 5, control: 7 };
        
        //
        // Shuttle Diplomacy
        //
        if (this.game.state.events.shuttlediplomacy == 1) {
          if (scoring.ussr.bg > 0) {
            scoring.ussr.bg--;
          }         
          if (mouseover_preview == 0) { //commit score
            scoring.shuttle = 1;
            this.game.state.events.shuttlediplomacy = 0;
      	    this.game.deck[0].discards['shuttle'] = this.game.deck[0].cards['shuttle'];
          }
        }

        scoring = this.determineRegionVictor(scoring, scoring_range, bg_countries.length);

        break;

      /////////////
      // SE ASIA // -- Manually run this since every country counts as a battleground no no (control/presence/dominate)
      /////////////
      case "seasia":
        let seasia_countries = ["burma","laos", "vietnam", "malaysia", "philippines", "indonesia"/*, "thailand"*/];

        for (country of seasia_countries) {
          for (var [player, side] of Object.entries(scoring)) {
            if (this.isControlled(player, country) == 1) { side.total++; }
          }
        }
        switch (this.whoControls("thailand")){
          case "us": scoring.us.bg = 2; scoring.us.status = "Thailand"; break;
          case "ussr": scoring.ussr.bg = 2; scoring.ussr.status = "Thailand"; break;
        }


        scoring.us.vp = scoring.us.total + scoring.us.bg;
        scoring.ussr.vp = scoring.ussr.total + scoring.ussr.bg;
        break;


      /////////////
      // AFRICA  //
      /////////////
      case "africa":

        scoring_range = {presence: 1, domination: 4, control: 6 };

        scoring = this.determineRegionVictor(scoring, scoring_range, bg_countries.length);

        break;

      /////////////////////
      // CENTRAL AMERICA //
      /////////////////////
      case "camerica":
        scoring_range = {presence: 1, domination: 3, control: 5};

        scoring = this.determineRegionVictor(scoring, scoring_range, bg_countries.length);

        // neighbouring countries
        scoring.us.neigh = [];
        scoring.ussr.neigh = [];

        if (this.isControlled("ussr", "mexico") == 1) { scoring.ussr.vp++; scoring.ussr.neigh.push("mexico");}
        if (this.isControlled("ussr", "cuba") == 1) { scoring.ussr.vp++; scoring.ussr.neigh.push("cuba");}

        break;

      ///////////////////
      // SOUTH AMERICA //
      ///////////////////
      case "samerica":
        scoring_range = {presence: 2, domination: 5, control: 6};

        scoring = this.determineRegionVictor(scoring, scoring_range, bg_countries.length);

        break;

      //////////
      // ASIA //
      //////////
      case "asia":
        
        //Move Taiwan to BG if necessay
        if (this.game.state.events.formosan == 1 && this.isControlled("us", "taiwan") == 1) {
          bg_countries.push("taiwan");
          scoring.us.bg++;
          scoring.us.total--;
        }
        
        scoring_range = {presence: 3, domination: 7, control: 9};

        //
        // Shuttle Diplomacy
        //
        let ussr_bonus = true;

        if (this.game.state.events.shuttlediplomacy == 1) {
          if (scoring.ussr.bg > 0) {
            scoring.ussr.bg--;
          }
	        if (mouseover_preview == 0) {
            scoring.shuttle = 1;
            this.game.state.events.shuttlediplomacy = 0;
      	    this.game.deck[0].discards['shuttle'] = this.game.deck[0].cards['shuttle'];
            
            if (this.isControlled("ussr", "japan") == 1) { 
               this.updateLog("USSR loses Japan/US-adjacency with Shuttle Diplomacy");
               ussr_bonus = false;
            }
          }
      	}

        scoring = this.determineRegionVictor(scoring, scoring_range, bg_countries.length);

	
        //
        // neighbouring countries
        //
        scoring.us.neigh = [];
        scoring.ussr.neigh = [];

        if (this.isControlled("us", "afghanistan") == 1) { scoring.us.vp++; scoring.us.neigh.push("afghanistan");}
        if (this.isControlled("us", "northkorea") == 1) { scoring.us.vp++; scoring.us.neigh.push("northkorea");}
        if (this.isControlled("ussr", "japan") == 1) { 
          if (ussr_bonus) { 
  	        scoring.ussr.vp++; 
            scoring.ussr.neigh.push("japan");
  	      }
	      }

        break;
      }
    return scoring;
  
  }


  /*
  Necessary for summit card
  */
  doesPlayerDominateRegion(player, region) {

    let total_us = 0;
    let total_ussr = 0;
    let bg_us = 0;
    let bg_ussr = 0;
    let vp_us = 0;
    let vp_ussr = 0;


    ////////////
    // EUROPE //
    ////////////
    if (region == "europe") {

      if (this.isControlled("us", "italy") == 1) { bg_us++; }
      if (this.isControlled("ussr", "italy") == 1) { bg_ussr++; }
      if (this.isControlled("us", "france") == 1) { bg_us++; }
      if (this.isControlled("ussr", "france") == 1) { bg_ussr++; }
      if (this.isControlled("us", "westgermany") == 1) { bg_us++; }
      if (this.isControlled("ussr", "westgermany") == 1) { bg_ussr++; }
      if (this.isControlled("us", "eastgermany") == 1) { bg_us++; }
      if (this.isControlled("ussr", "eastgermany") == 1) { bg_ussr++; }
      if (this.isControlled("us", "poland") == 1) { bg_us++; }
      if (this.isControlled("ussr", "poland") == 1) { bg_ussr++; }

      total_us = bg_us;
      total_ussr = bg_ussr;

      if (this.isControlled("us", "spain") == 1) { total_us++; }
      if (this.isControlled("ussr", "spain") == 1) { total_ussr++; }
      if (this.isControlled("us", "greece") == 1) { total_us++; }
      if (this.isControlled("ussr", "greece") == 1) { total_ussr++; }
      if (this.isControlled("us", "turkey") == 1) { total_us++; }
      if (this.isControlled("ussr", "turkey") == 1) { total_ussr++; }
      if (this.isControlled("us", "yugoslavia") == 1) { total_us++; }
      if (this.isControlled("ussr", "yugoslavia") == 1) { total_ussr++; }
      if (this.isControlled("us", "bulgaria") == 1) { total_us++; }
      if (this.isControlled("ussr", "bulgaria") == 1) { total_ussr++; }
      if (this.isControlled("us", "austria") == 1) { total_us++; }
      if (this.isControlled("ussr", "austria") == 1) { total_ussr++; }
      if (this.isControlled("us", "romania") == 1) { total_us++; }
      if (this.isControlled("ussr", "romania") == 1) { total_ussr++; }
      if (this.isControlled("us", "hungary") == 1) { total_us++; }
      if (this.isControlled("ussr", "hungary") == 1) { total_ussr++; }
      if (this.isControlled("us", "czechoslovakia") == 1) { total_us++; }
      if (this.isControlled("ussr", "czechoslovakia") == 1) { total_ussr++; }
      if (this.isControlled("us", "benelux") == 1) { total_us++; }
      if (this.isControlled("ussr", "benelux") == 1) { total_ussr++; }
      if (this.isControlled("us", "uk") == 1) { total_us++; }
      if (this.isControlled("ussr", "uk") == 1) { total_ussr++; }
      if (this.isControlled("us", "canada") == 1) { total_us++; }
      if (this.isControlled("ussr", "canada") == 1) { total_ussr++; }
      if (this.isControlled("us", "norway") == 1) { total_us++; }
      if (this.isControlled("ussr", "norway") == 1) { total_ussr++; }
      if (this.isControlled("us", "denmark") == 1) { total_us++; }
      if (this.isControlled("ussr", "denmark") == 1) { total_ussr++; }
      if (this.isControlled("us", "sweden") == 1) { total_us++; }
      if (this.isControlled("ussr", "sweden") == 1) { total_ussr++; }
      if (this.isControlled("us", "finland") == 1) { total_us++; }
      if (this.isControlled("ussr", "finland") == 1) { total_ussr++; }

      if (total_us > 0) { vp_us = 3; }
      if (total_ussr> 0) { vp_ussr = 3; }

      if (bg_us > bg_ussr && total_us > bg_us && total_us > total_ussr) { vp_us = 7; }
      if (bg_ussr > bg_us && total_ussr > bg_ussr && total_ussr > total_us) { vp_ussr = 7; }

      if (total_us == 6 && total_us > total_ussr) { vp_us = 10000; }
      if (total_ussr == 6 && total_us > total_ussr) { vp_ussr = 10000; }

      vp_us = vp_us + bg_us;
      vp_ussr = vp_ussr + bg_ussr;

      if ((vp_us >= vp_ussr+2 && total_us > bg_us) || (bg_us == 5 && total_us > total_ussr)) {
        if (player == "us") { return 1; }
        if (player == "ussr") { return 0; }
      }
      if ((vp_ussr >= vp_us+2 && total_ussr > bg_ussr) || (bg_ussr == 5 && total_ussr > total_us)) {
        if (player == "us") { return 0; }
        if (player == "ussr") { return 1; }
      }
    }



    /////////////////
    // MIDDLE EAST //
    /////////////////
    if (region == "mideast") {

      if (this.isControlled("us", "libya") == 1) { bg_us++; }
      if (this.isControlled("ussr", "libya") == 1) { bg_ussr++; }
      if (this.isControlled("us", "egypt") == 1) { bg_us++; }
      if (this.isControlled("ussr", "egypt") == 1) { bg_ussr++; }
      if (this.isControlled("us", "israel") == 1) { bg_us++; }
      if (this.isControlled("ussr", "israel") == 1) { bg_ussr++; }
      if (this.isControlled("us", "iraq") == 1) { bg_us++; }
      if (this.isControlled("ussr", "iraq") == 1) { bg_ussr++; }
      if (this.isControlled("us", "iran") == 1) { bg_us++; }
      if (this.isControlled("ussr", "iran") == 1) { bg_ussr++; }
      if (this.isControlled("us", "saudiarabia") == 1) { bg_us++; }
      if (this.isControlled("ussr", "saudiarabia") == 1) { bg_ussr++; }

      total_us = bg_us;
      total_ussr = bg_ussr;

      if (this.isControlled("us", "lebanon") == 1) { total_us++; }
      if (this.isControlled("ussr", "lebanon") == 1) { total_ussr++; }
      if (this.isControlled("us", "syria") == 1) { total_us++; }
      if (this.isControlled("ussr", "syria") == 1) { total_ussr++; }
      if (this.isControlled("us", "jordan") == 1) { total_us++; }
      if (this.isControlled("ussr", "jordan") == 1) { total_ussr++; }
      if (this.isControlled("us", "gulfstates") == 1) { total_us++; }
      if (this.isControlled("ussr", "gulfstates") == 1) { total_ussr++; }

      if (total_us > 0) { vp_us = 3; }
      if (total_ussr> 0) { vp_ussr = 3; }

      if (bg_us > bg_ussr && total_us > bg_us && total_us > total_ussr) { vp_us = 5; }
      if (bg_ussr > bg_us && total_ussr > bg_ussr && total_ussr > total_us) { vp_ussr = 5; }

      if (total_us == 7 && total_us > total_ussr) { vp_us = 7; }
      if (total_ussr == 7 && total_us > total_ussr) { vp_ussr = 7; }

      vp_us = vp_us + bg_us;
      vp_ussr = vp_ussr + bg_ussr;

      if ((vp_us >= vp_ussr+2 && total_us > bg_us) || (bg_us == 6 && total_us > total_ussr)) {
        if (player == "us") { return 1; }
        if (player == "ussr") { return 0; }
      }
      if ((vp_ussr >= vp_us+2 && total_ussr > bg_ussr) || (bg_ussr == 6 && total_ussr > total_us)) {
        if (player == "us") { return 0; }
        if (player == "ussr") { return 1; }
      }
    }



    ////////////
    // AFRICA //
    ////////////
    if (region == "africa") {

      if (this.isControlled("us", "algeria") == 1) { bg_us++; }
      if (this.isControlled("ussr", "algeria") == 1) { bg_ussr++; }
      if (this.isControlled("us", "nigeria") == 1) { bg_us++; }
      if (this.isControlled("ussr", "nigeria") == 1) { bg_ussr++; }
      if (this.isControlled("us", "zaire") == 1) { bg_us++; }
      if (this.isControlled("ussr", "zaire") == 1) { bg_ussr++; }
      if (this.isControlled("us", "angola") == 1) { bg_us++; }
      if (this.isControlled("ussr", "angola") == 1) { bg_ussr++; }
      if (this.isControlled("us", "southafrica") == 1) { bg_us++; }
      if (this.isControlled("ussr", "southafrica") == 1) { bg_ussr++; }

      total_us = bg_us;
      total_ussr = bg_ussr;

      if (this.isControlled("us", "morocco") == 1) { total_us++; }
      if (this.isControlled("ussr", "morocco") == 1) { total_ussr++; }
      if (this.isControlled("us", "tunisia") == 1) { total_us++; }
      if (this.isControlled("ussr", "tunisia") == 1) { total_ussr++; }
      if (this.isControlled("us", "westafricanstates") == 1) { total_us++; }
      if (this.isControlled("ussr", "westafricanstates") == 1) { total_ussr++; }
      if (this.isControlled("us", "saharanstates") == 1) { total_us++; }
      if (this.isControlled("ussr", "saharanstates") == 1) { total_ussr++; }
      if (this.isControlled("us", "sudan") == 1) { total_us++; }
      if (this.isControlled("ussr", "sudan") == 1) { total_ussr++; }
      if (this.isControlled("us", "ivorycoast") == 1) { total_us++; }
      if (this.isControlled("ussr", "ivorycoast") == 1) { total_ussr++; }
      if (this.isControlled("us", "ethiopia") == 1) { total_us++; }
      if (this.isControlled("ussr", "ethiopia") == 1) { total_ussr++; }
      if (this.isControlled("us", "somalia") == 1) { total_us++; }
      if (this.isControlled("ussr", "somalia") == 1) { total_ussr++; }
      if (this.isControlled("us", "cameroon") == 1) { total_us++; }
      if (this.isControlled("ussr", "cameroon") == 1) { total_ussr++; }
      if (this.isControlled("us", "kenya") == 1) { total_us++; }
      if (this.isControlled("ussr", "kenya") == 1) { total_ussr++; }
      if (this.isControlled("us", "seafricanstates") == 1) { total_us++; }
      if (this.isControlled("ussr", "seafricanstates") == 1) { total_ussr++; }
      if (this.isControlled("us", "zimbabwe") == 1) { total_us++; }
      if (this.isControlled("ussr", "zimbabwe") == 1) { total_ussr++; }
      if (this.isControlled("us", "botswana") == 1) { total_us++; }
      if (this.isControlled("ussr", "botswana") == 1) { total_ussr++; }

      if (total_us > 0) { vp_us = 1; }
      if (total_ussr> 0) { vp_ussr = 1; }

      if (bg_us > bg_ussr && total_us > bg_us && total_us > total_ussr) { vp_us = 4; }
      if (bg_ussr > bg_us && total_ussr > bg_ussr && total_ussr > total_us) { vp_ussr = 4; }

      if (total_us == 7 && total_us > total_ussr) { vp_us = 6; }
      if (total_ussr == 7 && total_us > total_ussr) { vp_ussr = 6; }

      vp_us = vp_us + bg_us;
      vp_ussr = vp_ussr + bg_ussr;

      if ((vp_us >= vp_ussr+2 && total_us > bg_us) || (bg_us == 5 && total_us > total_ussr)) {
        if (player == "us") { return 1; }
        if (player == "ussr") { return 0; }
      }
      if ((vp_ussr >= vp_us+2 && total_ussr > bg_ussr) || (bg_ussr == 5 && total_ussr > total_us)) {
        if (player == "us") { return 0; }
        if (player == "ussr") { return 1; }
      }
    }



    /////////////////////
    // CENTRAL AMERICA //
    /////////////////////
    if (region == "camerica") {

      if (this.isControlled("us", "mexico") == 1) { bg_us++; }
      if (this.isControlled("ussr", "mexico") == 1) { bg_ussr++; }
      if (this.isControlled("us", "cuba") == 1) { bg_us++; }
      if (this.isControlled("ussr", "cuba") == 1) { bg_ussr++; }
      if (this.isControlled("us", "panama") == 1) { bg_us++; }
      if (this.isControlled("ussr", "panama") == 1) { bg_ussr++; }

      total_us = bg_us;
      total_ussr = bg_ussr;

      if (this.isControlled("us", "guatemala") == 1) { total_us++; }
      if (this.isControlled("ussr", "guatemala") == 1) { total_ussr++; }
      if (this.isControlled("us", "elsalvador") == 1) { total_us++; }
      if (this.isControlled("ussr", "elsalvador") == 1) { total_ussr++; }
      if (this.isControlled("us", "honduras") == 1) { total_us++; }
      if (this.isControlled("ussr", "honduras") == 1) { total_ussr++; }
      if (this.isControlled("us", "costarica") == 1) { total_us++; }
      if (this.isControlled("ussr", "costarica") == 1) { total_ussr++; }
      if (this.isControlled("us", "nicaragua") == 1) { total_us++; }
      if (this.isControlled("ussr", "nicaragua") == 1) { total_ussr++; }
      if (this.isControlled("us", "haiti") == 1) { total_us++; }
      if (this.isControlled("ussr", "haiti") == 1) { total_ussr++; }
      if (this.isControlled("us", "dominicanrepublic") == 1) { total_us++; }
      if (this.isControlled("ussr", "dominicanrepublic") == 1) { total_ussr++; }

      if (total_us > 0) { vp_us = 1; }
      if (total_ussr> 0) { vp_ussr = 1; }

      if (bg_us > bg_ussr && total_us > bg_us && total_us > total_ussr) { vp_us = 3; }
      if (bg_ussr > bg_us && total_ussr > bg_ussr && total_ussr > total_us) { vp_ussr = 3; }

      if (total_us == 7 && total_us > total_ussr) { vp_us = 5; }
      if (total_ussr == 7 && total_us > total_ussr) { vp_ussr = 5; }

      vp_us = vp_us + bg_us;
      vp_ussr = vp_ussr + bg_ussr;

      if ((vp_us > vp_ussr && total_us > bg_us && bg_us > 0) || (bg_us == 3 && total_us > total_ussr)) {
        if (player == "us") { return 1; }
        if (player == "ussr") { return 0; }
      }
      if ((vp_ussr > vp_us && total_ussr > bg_ussr && bg_ussr > 0) || (bg_ussr == 3 && total_ussr > total_us)) {
        if (player == "us") { return 0; }
        if (player == "ussr") { return 1; }
      }
    }



    ///////////////////
    // SOUTH AMERICA //
    ///////////////////
    if (region == "samerica") {

      if (this.isControlled("us", "venezuela") == 1) { bg_us++; }
      if (this.isControlled("ussr", "venezuela") == 1) { bg_ussr++; }
      if (this.isControlled("us", "brazil") == 1) { bg_us++; }
      if (this.isControlled("ussr", "brazil") == 1) { bg_ussr++; }
      if (this.isControlled("us", "argentina") == 1) { bg_us++; }
      if (this.isControlled("ussr", "argentina") == 1) { bg_ussr++; }
      if (this.isControlled("us", "chile") == 1) { bg_us++; }
      if (this.isControlled("ussr", "chile") == 1) { bg_ussr++; }

      total_us = bg_us;
      total_ussr = bg_ussr;

      if (this.isControlled("us", "colombia") == 1) { total_us++; }
      if (this.isControlled("ussr", "colombia") == 1) { total_ussr++; }
      if (this.isControlled("us", "ecuador") == 1) { total_us++; }
      if (this.isControlled("ussr", "ecuador") == 1) { total_ussr++; }
      if (this.isControlled("us", "peru") == 1) { total_us++; }
      if (this.isControlled("ussr", "peru") == 1) { total_ussr++; }
      if (this.isControlled("us", "bolivia") == 1) { total_us++; }
      if (this.isControlled("ussr", "bolivia") == 1) { total_ussr++; }
      if (this.isControlled("us", "paraguay") == 1) { total_us++; }
      if (this.isControlled("ussr", "paraguay") == 1) { total_ussr++; }
      if (this.isControlled("us", "uruguay") == 1) { total_us++; }
      if (this.isControlled("ussr", "uruguay") == 1) { total_ussr++; }

      if (total_us > 0) { vp_us = 2; }
      if (total_ussr> 0) { vp_ussr = 2; }

      if (bg_us > bg_ussr && total_us > bg_us && total_us > total_ussr) { vp_us = 5; }
      if (bg_ussr > bg_us && total_ussr > bg_ussr && total_ussr > total_us) { vp_ussr = 5; }

      if (total_us == 7 && total_us > total_ussr) { vp_us = 6; }
      if (total_ussr == 7 && total_us > total_ussr) { vp_ussr = 6; }

      vp_us = vp_us + bg_us;
      vp_ussr = vp_ussr + bg_ussr;

      if ((vp_us > vp_ussr+2 && total_us > bg_us && bg_us > 0) || (bg_us == 4 && total_us > total_ussr)) {
        if (player == "us") { return 1; }
        if (player == "ussr") { return 0; }
      }
      if ((vp_ussr > vp_us+2 && total_ussr > bg_ussr && bg_ussr > 0) || (bg_ussr == 4 && total_ussr > total_us)) {
        if (player == "us") { return 0; }
        if (player == "ussr") { return 1; }
      }

    }




    //////////
    // ASIA //
    //////////
    if (region == "asia") {

      if (this.isControlled("us", "northkorea") == 1) { bg_us++; }
      if (this.isControlled("ussr", "northkorea") == 1) { bg_ussr++; }
      if (this.isControlled("us", "southkorea") == 1) { bg_us++; }
      if (this.isControlled("ussr", "southkorea") == 1) { bg_ussr++; }
      if (this.isControlled("us", "japan") == 1) { bg_us++; }
      if (this.isControlled("ussr", "japan") == 1) { bg_ussr++; }
      if (this.isControlled("us", "thailand") == 1) { bg_us++; }
      if (this.isControlled("ussr", "thailand") == 1) { bg_ussr++; }
      if (this.isControlled("us", "india") == 1) { bg_us++; }
      if (this.isControlled("ussr", "india") == 1) { bg_ussr++; }
      if (this.isControlled("us", "pakistan") == 1) { bg_us++; }
      if (this.isControlled("ussr", "pakistan") == 1) { bg_ussr++; }
      if (this.game.state.events.formosan == 1) {
        if (this.isControlled("us", "taiwan") == 1) { bg_us++; }
      }

      total_us = bg_us;
      total_ussr = bg_ussr;

      if (this.isControlled("us", "afghanistan") == 1) { total_us++; }
      if (this.isControlled("ussr", "afghanistan") == 1) { total_ussr++; }
      if (this.isControlled("us", "burma") == 1) { total_us++; }
      if (this.isControlled("ussr", "burma") == 1) { total_ussr++; }
      if (this.isControlled("us", "laos") == 1) { total_us++; }
      if (this.isControlled("ussr", "laos") == 1) { total_ussr++; }
      if (this.isControlled("us", "vietnam") == 1) { total_us++; }
      if (this.isControlled("ussr", "vietnam") == 1) { total_ussr++; }
      if (this.isControlled("us", "malaysia") == 1) { total_us++; }
      if (this.isControlled("ussr", "malaysia") == 1) { total_ussr++; }
      if (this.isControlled("us", "australia") == 1) { total_us++; }
      if (this.isControlled("ussr", "australia") == 1) { total_ussr++; }
      if (this.isControlled("us", "indonesia") == 1) { total_us++; }
      if (this.isControlled("ussr", "indonesia") == 1) { total_ussr++; }
      if (this.isControlled("us", "philippines") == 1) { total_us++; }
      if (this.isControlled("ussr", "philippines") == 1) { total_ussr++; }

      if (total_us > 0) { vp_us = 3; }
      if (total_ussr> 0) { vp_ussr = 3; }

      if (bg_us > bg_ussr && total_us > bg_us && total_us > total_ussr) { vp_us = 7; }
      if (bg_ussr > bg_us && total_ussr > bg_ussr && total_ussr > total_us) { vp_ussr = 7; }

      if (this.game.state.events.formosan == 1) {
        if (total_us == 7 && total_us > total_ussr) { vp_us = 9; }
        if (total_ussr == 7 && total_us > total_ussr) { vp_ussr = 9; }
      } else {
        if (total_us == 6 && total_us > total_ussr) { vp_us = 9; }
        if (total_ussr == 6 && total_us > total_ussr) { vp_ussr = 9; }
      }

      vp_us = vp_us + bg_us;
      vp_ussr = vp_ussr + bg_ussr;

      if ((vp_us > vp_ussr+2 && total_us > bg_us && bg_us > 0) || (bg_us >= 6 && total_us > total_ussr)) {
      	if (bg_us == 6 && this.isControlled("us", "taiwan") == 1 && this.game.state.events.formosan == 1) { return 0; }
        if (player == "us") { return 1; }
        if (player == "ussr") { return 0; }
      }
      if ((vp_ussr > vp_us+2 && total_ussr > bg_ussr && bg_ussr > 0) || (bg_ussr == 6 && total_ussr > total_us)) {
        if (player == "us") { return 0; }
        if (player == "ussr") { return 1; }
      }
    }

    return 0;

  }



  
  updateRound() {

    let dt = 0;
    let dl = 0;

    let rid = this.game.state.round - 1;
    rid = Math.max(rid,0); //Collapse state.round = 0 & 1 into rid = 0;

    dt = this.game.state.round_ps[rid].top;
    dl = this.game.state.round_ps[rid].left;
  
    dt = this.scale(dt)+"px";
    dl = this.scale(dl)+"px";

    $('.round').css('width', this.scale(140)+"px");
    $('.round').css('height', this.scale(140)+"px");
    $('.round').css('top', dt);
    $('.round').css('left', dl);

  }


  lowerDefcon() {

    //
    // END OF HISTORY
    //
    if ((this.game.state.events.manwhosavedtheworld === "us" && this.game.state.turn == 2) || (this.game.state.events.manwhosavedtheworld === "ussr" && this.game.state.turn == 1)) {
      if (this.game.state.defcon == 2) {
        this.game.state.events.manwhosavedtheworld = "";
        this.updateLog("Man Who Saved the World prevents thermonuclear war");
        return;
      }
    }


    this.game.state.defcon--;
    this.updateDefcon();

    this.updateLog("DEFCON falls to " + this.game.state.defcon);

console.log("MONITORING DEFCON: in lowerDefcon() A ");
    if (this.game.state.events.norad == 1) {
console.log("MONITORING DEFCON: in lowerDefcon() B ");
      if (this.game.state.defcon == 2) {
console.log("MONITORING DEFCON: in lowerDefcon() C ");
        if (this.game.state.headline != 1) {
console.log("MONITORING DEFCON: in lowerDefcon() D ");
          this.game.state.us_defcon_bonus = 1;
        }
      }
    }

    if (this.game.state.defcon <= 1) {
      if (this.game.state.headline == 1) {
        // phasing player in headline loses
        this.endGame(this.game.players[2 - this.game.state.player_to_go], "thermonuclear war");
      }else{
        this.endGame(this.game.players[2 - this.game.state.turn], "thermonuclear war");  
      }
      return;
    }

  }


  updateDefcon() {

    if (this.game.state.defcon > 5) { this.game.state.defcon = 5; }

    let dt = 0;
    let dl = 0;

    if (this.game.state.defcon == 5) {
      dt = this.game.state.defcon_ps[0].top;
      dl = this.game.state.defcon_ps[0].left;
    }
    if (this.game.state.defcon == 4) {
      dt = this.game.state.defcon_ps[1].top;
      dl = this.game.state.defcon_ps[1].left;
    }
    if (this.game.state.defcon == 3) {
      dt = this.game.state.defcon_ps[2].top;
      dl = this.game.state.defcon_ps[2].left;
    }
    if (this.game.state.defcon == 2) {
      dt = this.game.state.defcon_ps[3].top;
      dl = this.game.state.defcon_ps[3].left;
    }
    if (this.game.state.defcon == 1) {
      dt = this.game.state.defcon_ps[4].top;
      dl = this.game.state.defcon_ps[4].left;
    }

    dt = this.scale(dt) + "px";
    dl = this.scale(dl) + "px";

    dt = dt;
    dl = dl;

    $('.defcon').css('width', this.scale(120)+"px");
    $('.defcon').css('height', this.scale(120)+"px");
    $('.defcon').css('top', dt);
    $('.defcon').css('left', dl);

  }



  updateActionRound() {

    let dt = 0;
    let dl = 0;
    let dt_us = 0;
    let dl_us = 0;

    let turn_in_round = this.game.state.turn_in_round;

    if (turn_in_round == 0) {
      dt = this.game.state.ar_ps[0].top;
      dl = this.game.state.ar_ps[0].left;
    }
    if (turn_in_round == 1) {
      dt = this.game.state.ar_ps[0].top;
      dl = this.game.state.ar_ps[0].left;
    }
    if (turn_in_round == 2) {
      dt = this.game.state.ar_ps[1].top;
      dl = this.game.state.ar_ps[1].left;
    }
    if (turn_in_round == 3) {
      dt = this.game.state.ar_ps[2].top;
      dl = this.game.state.ar_ps[2].left;
    }
    if (turn_in_round == 4) {
      dt = this.game.state.ar_ps[3].top;
      dl = this.game.state.ar_ps[3].left;
    }
    if (turn_in_round == 5) {
      dt = this.game.state.ar_ps[4].top;
      dl = this.game.state.ar_ps[4].left;
    }
    if (turn_in_round == 6) {
      dt = this.game.state.ar_ps[5].top;
      dl = this.game.state.ar_ps[5].left;
    }
    if (turn_in_round == 7) {
      dt = this.game.state.ar_ps[6].top;
      dl = this.game.state.ar_ps[6].left;
    }
    if (turn_in_round == 8) {
      dt = this.game.state.ar_ps[7].top;
      dl = this.game.state.ar_ps[7].left;
    }

    dt = this.scale(dt)+"px";
    dl = this.scale(dl)+"px";

    if (this.game.state.turn == 1) {
      $('.action_round_us').hide();
      $('.action_round_ussr').show();
      $('.action_round_ussr').css('width', this.scale(100)+"px");
      $('.action_round_ussr').css('height', this.scale(100)+"px");
      $('.action_round_ussr').css('top', dt);
      $('.action_round_ussr').css('left', dl);
    } else {
      $('.action_round_ussr').hide();
      $('.action_round_us').show();
      $('.action_round_us').css('width', this.scale(100)+"px");
      $('.action_round_us').css('height', this.scale(100)+"px");
      $('.action_round_us').css('top', dt);
      $('.action_round_us').css('left', dl);
    }

    let rounds_this_turn = 6;
    if (this.game.state.round > 3) { rounds_this_turn = 7; }
    if (this.game.state.northseaoil == 1 && this.game.player == 2) { rounds_this_turn++; }
    if (this.game.state.space_station === "us" && this.game.player == 2) { rounds_this_turn++; }
    if (this.game.state.space_station === "ussr" && this.game.player == 1) { rounds_this_turn++; }

    $('.action_round_cover').css('width', this.scale(100)+"px");
    $('.action_round_cover').css('height', this.scale(100)+"px");

    let dt8 = this.scale(this.game.state.ar_ps[7].top) + "px";
    let dl8 = this.scale(this.game.state.ar_ps[7].left) + "px";
    let dt7 = this.scale(this.game.state.ar_ps[6].top) + "px";
    let dl7 = this.scale(this.game.state.ar_ps[6].left) + "px";

    $('.action_round_8_cover').css('top', dt8);
    $('.action_round_8_cover').css('left', dl8);
    $('.action_round_7_cover').css('top', dt7);
    $('.action_round_7_cover').css('left', dl7);

    if (rounds_this_turn < 8) { $('.action_round_8_cover').css('display','all'); } else { $('.action_round_8_cover').css('display','none'); }
    if (rounds_this_turn < 7) { $('.action_round_7_cover').css('display','all'); } else { $('.action_round_7_cover').css('display','none'); }

  }



  advanceSpaceRace(player) {

    this.displayModal(`${player.toUpperCase()} advances in the Space Race`);
    //Parameters to simplify the function
    let sr_player = "space_race_us";
    let sr_opponent = "space_race_ussr";

    if (player == "ussr"){
      sr_player = "space_race_ussr";
      sr_opponent = "space_race_us";
    }

    this.game.state[sr_player]++;

    let first = this.game.state[sr_player] > this.game.state[sr_opponent];
    let vp_change = 0;

    switch(this.game.state[sr_player]){
      case 1:  // Earth Satellite
        vp_change = (first) ? 2 : 1;
        break;
      case 2:  // Animal in Space
        this.game.state.animal_in_space = (first) ? player : "";
        break;
      case 3: // Man in Space
        vp_change = (first) ? 2 : 0;
        break;
      case 4: // Man in Earth Orbit
        this.game.state.man_in_earth_orbit = (first) ? player : "";
        break;
      case 5: // Lunar Orbit
        vp_change = (first) ? 3 : 1;
        break;
      case 6: // Eagle/Bear has Landed
        this.game.state.eagle_has_landed = (first) ? player : "";
        break;
      case 7:  // Space Shuttle
        vp_change = (first) ? 4 : 2;
        break;
      case 8:
        vp_change = (first) ? 2 : 0;
        this.game.state.space_station = (first) ? player : "";
        break;
    }

    if (player == "us"){
      this.game.state.vp += vp_change;  
    }else{
      this.game.state.vp -= vp_change;
    }
    
    this.updateVictoryPoints();
    this.updateSpaceRace();
  }



  updateSpaceRace() {
    
    if (!this.browser_active){return;}

    let dt_us = this.game.state.space_race_ps[this.game.state.space_race_us].top;
    let dl_us = this.game.state.space_race_ps[this.game.state.space_race_us].left;
    let dt_ussr = this.game.state.space_race_ps[this.game.state.space_race_ussr].top;
    let dl_ussr = this.game.state.space_race_ps[this.game.state.space_race_ussr].left;

    dt_us = this.scale(dt_us);
    dl_us = this.scale(dl_us);
    dt_ussr = this.scale(dt_ussr+40)+"px";
    dl_ussr = this.scale(dl_ussr+10)+"px";

    $('.space_race_us').css('width', this.scale(100)+"px");
    $('.space_race_us').css('height', this.scale(100)+"px");
    $('.space_race_us').css('top', dt_us);
    $('.space_race_us').css('left', dl_us);

    $('.space_race_ussr').css('width', this.scale(100)+"px");
    $('.space_race_ussr').css('height', this.scale(100)+"px");
    $('.space_race_ussr').css('top', dt_ussr);
    $('.space_race_ussr').css('left', dl_ussr);

  }



  updateEventTiles() {

    if (!this.browser_active){return;}

    try {

    if (this.game.state.events.warsawpact == 0) {
      $('#eventtile_warsaw').css('display','none');
    } else {
      $('#eventtile_warsaw').css('display','block');
    }

    if (this.game.state.events.degaulle == 0) {
      $('#eventtile_degaulle').css('display','none');
    } else {
      $('#eventtile_degaulle').css('display','block');
    }

    if (this.game.state.events.nato == 0) {
      $('#eventtile_nato').css('display','none');
    } else {
      $('#eventtile_nato').css('display','block');
    }

    if (this.game.state.events.marshall == 0) {
      $('#eventtile_marshall').css('display','none');
    } else {
      $('#eventtile_marshall').css('display','block');
    }

    if (this.game.state.events.usjapan == 0) {
      $('#eventtile_usjapan').css('display','none');
    } else {
      $('#eventtile_usjapan').css('display','block');
    }

    if (this.game.state.events.norad == 0) {
      $('#eventtile_norad').css('display','none');
    } else {
      $('#eventtile_norad').css('display','block');
    }

    if (this.game.state.events.quagmire == 0) {
      $('#eventtile_quagmire').css('display','none');
    } else {
      $('#eventtile_quagmire').css('display','block');
    }

    if (this.game.state.events.formosan == 0) {
      $('#eventtile_formosan').css('display','none');
      $('.formosan_resolution').css('display','none');
      $('.formosan_resolution').hide();
    } else {
      if (this.isControlled("ussr", "taiwan") != 1) {
        $('#eventtile_formosan').css('display','block');
        $('.formosan_resolution').css('display','block');
        $('.formosan_resolution').show();
      } else {
        $('.formosan_resolution').css('display','none');
        $('.formosan_resolution').hide();
      }
    }

    if (this.game.state.events.beartrap == 0) {
      $('#eventtile_beartrap').css('display','none');
    } else {
      $('#eventtile_beartrap').css('display','block');
    }

    if (this.game.state.events.willybrandt == 0) {
      $('#eventtile_willybrandt').css('display','none');
    } else {
      $('#eventtile_willybrandt').css('display','block');
    }

    if (this.game.state.events.campdavid == 0) {
      $('#eventtile_campdavid').css('display','none');
    } else {
      $('#eventtile_campdavid').css('display','block');
    }

    if (this.game.state.events.flowerpower == 0) {
      $('#eventtile_flowerpower').css('display','none');
    } else {
      $('#eventtile_flowerpower').css('display','block');
    }

    if (this.game.state.events.johnpaul == 0) {
      $('#eventtile_johnpaul').css('display','none');
    } else {
      $('#eventtile_johnpaul').css('display','block');
    }

    if (this.game.state.events.iranianhostage == 0) {
      $('#eventtile_iranianhostagecrisis').css('display','none');
    } else {
      $('#eventtile_iranianhostagecrisis').css('display','block');
    }

    if (this.game.state.events.shuttlediplomacy == 0) {
      $('#eventtile_shuttlediplomacy').css('display','none');
    } else {
      $('#eventtile_shuttlediplomacy').css('display','block');
    }

    if (this.game.state.events.ironlady == 0) {
      $('#eventtile_ironlady').css('display','none');
    } else {
      $('#eventtile_ironlady').css('display','block');
    }

    if (this.game.state.events.northseaoil == 0) {
      $('#eventtile_northseaoil').css('display','none');
    } else {
      $('#eventtile_northseaoil').css('display','block');
    }

    if (this.game.state.events.reformer == 0) {
      $('#eventtile_reformer').css('display','none');
    } else {
      $('#eventtile_reformer').css('display','block');
    }

    if (this.game.state.events.teardown == 0) {
      $('#eventtile_teardown').css('display','none');
    } else {
      $('#eventtile_teardown').css('display','block');
    }

    if (this.game.state.events.evilempire == 0) {
      $('#eventtile_evilempire').css('display','none');
    } else {
      $('#eventtile_evilempire').css('display','block');
    }

    if (this.game.state.events.awacs == 0) {
      $('#eventtile_awacs').css('display','none');
    } else {
      $('#eventtile_awacs').css('display','block');
    }

    } catch (err) {}

  }



  updateMilitaryOperations() {

    let dt_us = 0;
    let dl_us = 0;
    let dt_ussr = 0;
    let dl_ussr = 0;

    if (this.game.state.milops_us == 0) {
      dt_us = this.game.state.milops_ps[0].top;
      dl_us = this.game.state.milops_ps[0].left;
    }
    if (this.game.state.milops_us == 1) {
      dt_us = this.game.state.milops_ps[1].top;
      dl_us = this.game.state.milops_ps[1].left;
    }
    if (this.game.state.milops_us == 2) {
      dt_us = this.game.state.milops_ps[2].top;
      dl_us = this.game.state.milops_ps[2].left;
    }
    if (this.game.state.milops_us == 3) {
      dt_us = this.game.state.milops_ps[3].top;
      dl_us = this.game.state.milops_ps[3].left;
    }
    if (this.game.state.milops_us == 4) {
      dt_us = this.game.state.milops_ps[4].top;
      dl_us = this.game.state.milops_ps[4].left;
    }
    if (this.game.state.milops_us >= 5) {
      dt_us = this.game.state.milops_ps[5].top;
      dl_us = this.game.state.milops_ps[5].left;
    }

    if (this.game.state.milops_ussr == 0) {
      dt_ussr = this.game.state.milops_ps[0].top;
      dl_ussr = this.game.state.milops_ps[0].left;
    }
    if (this.game.state.milops_ussr == 1) {
      dt_ussr = this.game.state.milops_ps[1].top;
      dl_ussr = this.game.state.milops_ps[1].left;
    }
    if (this.game.state.milops_ussr == 2) {
      dt_ussr = this.game.state.milops_ps[2].top;
      dl_ussr = this.game.state.milops_ps[2].left;
    }
    if (this.game.state.milops_ussr == 3) {
      dt_ussr = this.game.state.milops_ps[3].top;
      dl_ussr = this.game.state.milops_ps[3].left;
    }
    if (this.game.state.milops_ussr == 4) {
      dt_ussr = this.game.state.milops_ps[4].top;
      dl_ussr = this.game.state.milops_ps[4].left;
    }
    if (this.game.state.milops_ussr >= 5) {
      dt_ussr = this.game.state.milops_ps[5].top;
      dl_ussr = this.game.state.milops_ps[5].left;
    }

    dt_us = this.scale(dt_us);
    dl_us = this.scale(dl_us);
    dt_ussr = this.scale(dt_ussr+40)+"px";
    dl_ussr = this.scale(dl_ussr+10)+"px";

    $('.milops_us').css('width', this.scale(100)+"px");
    $('.milops_us').css('height', this.scale(100)+"px");
    $('.milops_us').css('top', dt_us);
    $('.milops_us').css('left', dl_us);

    $('.milops_ussr').css('width', this.scale(100)+"px");
    $('.milops_ussr').css('height', this.scale(100)+"px");
    $('.milops_ussr').css('top', dt_ussr);
    $('.milops_ussr').css('left', dl_ussr);

  }



  updateVictoryPoints() {

    //
    // if VP are outstanding, do not update VP and trigger end
    //
    if (this.game.state.vp_outstanding != 0) { return; }
    if (!this.browser_active) { return; }

    let dt = 0;
    let dl = 0;

    if (this.game.state.vp <= -20) {
      dt = this.game.state.vp_ps[0].top;
      dl = this.game.state.vp_ps[0].left;
    }
    else if (this.game.state.vp >= 20) {
      dt = this.game.state.vp_ps[40].top;
      dl = this.game.state.vp_ps[40].left;
    }else{
      let vp_idx = this.game.state.vp + 20;
      dt = this.game.state.vp_ps[vp_idx].top;
      dl = this.game.state.vp_ps[vp_idx].left;
    }


    if (this.app.BROWSER == 1) {
      dt = this.scale(dt);
      dl = this.scale(dl);

      dt = dt + "px";
      dl = dl + "px";

      $('.vp').css('width', this.scale(120)+"px");
      $('.vp').css('height', this.scale(120)+"px");
      $('.vp').css('top', dt);
      $('.vp').css('left', dl);
    }

    if (this.game.state.vp > 19) {
        this.endGame(this.game.players[1], "victory point track");
    }
    if (this.game.state.vp < -19) {
      this.endGame(this.game.players[0], "victory point track");
    }

  }

  /////////////////////////
  cardToText(cardname, textonly = false){
    let card = this.game.deck[0].cards[cardname] || this.game.deck[0].discards[cardname] || this.game.deck[0].removed[cardname];
    try{
      if (textonly){
        return card.name;
      }else{
        return `<span class="showcard" id="${cardname}">${card.name}</span>`;
      }
    }catch(err){
      console.log(err);
      console.log(cardname,this.game.deck[0].cards[cardname], card);
    }
  }

  returnCardImage(cardname) {
    let cardclass = "cardimg";

    var c = this.game.deck[0].cards[cardname];
    if (c == undefined) { c = this.game.deck[0].discards[cardname]; }
    if (c == undefined) { c = this.game.deck[0].removed[cardname]; }
    if (c == undefined) {

      //
      // this is not a card, it is something like "skip turn" or cancel
      //
      return `<div class="noncard" id="${cardname.replaceAll(" ","")}">${cardname}</div>`;

    }

    var html = `<img class="${cardclass}" src="/twilight/img/${this.lang}/${c.img}.svg" />`;

    //
    // cards can be generated with http://www.invadethree.space/tscardgen/
    // as long as they have the string "png" included in the name they will
    // be treated as fully formed (i.e. not SVG files). The convention is to
    // name these cards starting at 201 in order to avoid conflict with other
    // cards that may be released officially.
    //
    if (c.img.indexOf("png") > -1) {
        html = `<img class="${cardclass}" src="/twilight/img/${this.lang}/${c.img}.png" />`;
    } else {
        if (c.p == 0) { html += `<img class="${cardclass}" src="/twilight/img/EarlyWar.svg" />`; }
        if (c.p == 1) { html += `<img class="${cardclass}" src="/twilight/img/MidWar.svg" />`; }
        if (c.p == 2) { html += `<img class="${cardclass}" src="/twilight/img/LateWar.svg" />`; }

      switch (c.player) {
        case "both":
          html += `<img class="${cardclass}" src="/twilight/img/BothPlayerCard.svg" />`;
          if (c.ops) {
            html += `<img class="${cardclass}" src="/twilight/img/White${c.ops}.svg" />`;
            html += `<img class="${cardclass}" src="/twilight/img/Black${c.ops}.svg" />`;
          }
          break;
        case "us":
          html += `<img class="${cardclass}" src="/twilight/img/AmericanPlayerCard.svg" />`;
          if (c.ops) { html += `<img class="${cardclass}" src="/twilight/img/Black${c.ops}.svg" />`; }
          break;
        case "ussr":
          html += `<img class="${cardclass}" src="/twilight/img/SovietPlayerCard.svg" />`;
          if (c.ops) { html += `<img class="${cardclass}" src="/twilight/img/White${c.ops}.svg" />`; }
          break;
        default:
          break;
      }
    }

    if (c.scoring == 1) {
      html +=`<img class="${cardclass}" src="/twilight/img/MayNotBeHeld.svg" />`;
    } else if (c.recurring == 0) {
      if (c.img.indexOf("png") > -1) {} else {
        html += `<img class="${cardclass}" src="/twilight/img/RemoveFromPlay.svg" />`;
      }
    }

    return html
  }

  
   mobileCardSelect(card, player, mycallback, prompttext="play") {

    let twilight_self = this;

    twilight_self.hideCard();
    twilight_self.showPlayableCard(card);

    $('.cardbox_menu_playcard').html(prompttext);
    $('.cardbox_menu_playcard').css('display','block');
    $('.cardbox_menu_playcard').off();
    $('.cardbox_menu_playcard').on('click', function () {
      $('.cardbox_menu').css('display','none');
      twilight_self.hideCard();
      mycallback();
      $(this).hide();
      $('.cardbox-exit').hide();
    });
    $('.cardbox-exit').off();
    $('.cardbox-exit').on('click', function () {
      twilight_self.hideCard();
      $('.cardbox_menu_playcard').css('display','none');
      $(this).css('display', 'none');
    });

  }
  showPlayableCard(cardname) {
    let card_html = this.returnCardImage(cardname,0);
    let cardbox_html = this.app.browser.isMobileBrowser(navigator.userAgent) ?
      `${card_html}
      <div id="cardbox-exit-background">
        <div class="cardbox-exit" id="cardbox-exit">×</div>
      </div>
      <div class="cardbox_menu_playcard cardbox_menu_btn" id="cardbox_menu_playcard">
        PLAY
      </div>` : card_html;

    $('#cardbox').html(cardbox_html);
    $('#cardbox').show();
  }

  hideCard() {
    this.cardbox.hide(1);
  }


  returnSingularGameOption(){
    return `<div><label for="player1">Play as:</label>
            <select name="player1">
              <option value="random" selected>random</option>
              <option value="ussr">USSR</option>
              <option value="us">US</option>
            </select></div>
          `;
  }

  returnGameOptionsHTML() {

    return `

      <div style="padding:40px;width:100vw;height:100vh;overflow-y:scroll;display:grid;grid-template-columns: 200px auto">

	<div style="top:0;left:0;">

            

            <label for="deck">Deck:</label>
            <select name="deck" id="deckselect" onchange='
	      if ($("#deckselect").val() == "saito") { 
		$(".saito_edition").prop("checked",true); 
		$(".endofhistory_edition").prop("checked", false); 
	      } else { 
		$(".saito_edition").prop("checked", false); 
	        if ($("#deckselect").val() == "optional") { 
		  $(".optional_edition").prop("checked", false); 
	 	} else { 
		  $(".optional_edition").prop("checked", true); 
		  if ($("#deckselect").val() == "endofhistory") { 
		    $(".endofhistory_edition").prop("checked",true); 
		    $(".optional_edition").prop("checked", false);
		  } else {
		    if ($("#deckselect").val() == "coldwarcrazies") { 
		      $(".coldwarcrazies_edition").prop("checked",true); 
		      $(".optional_edition").prop("checked", false);
		    } else {
		      if ($("#deckselect").val() == "absurdum") { 
		        $(".absurdum_edition").prop("checked",true); 
		        $(".optional_edition").prop("checked",true);
		      }
		    }
		  }
		}
	      } '>
            <option value="original">original</option>
              <option value="optional" selected>optional</option>
              <option value="saito">saito edition</option>
              <option value="absurdum">twilight absurdum</option>
              <option value="endofhistory">end of history</option>
              <option value="coldwarcrazies">cold war crazies</option>
            </select>

            <label for="usbonus">US bonus: </label>
            <select name="usbonus">
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2" selected>2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
              <option value="6">6</option>
              <option value="7">7</option>
              <option value="8">8</option>
              <option value="9">9</option>
              <option value="10">10</option>
            </select>

            <label for="clock">Player Time Limit:</label>
            <select name="clock">
              <option value="0" default>no limit</option>
              <option value="10">10 minutes</option>
              <option value="20">20 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">60 minutes</option>
              <option value="90">90 minutes</option>
              <option value="120">120 minutes</option>
            </select>

            <label for="observer_mode">Observer Mode:</label>
            <select name="observer">
              <option value="enable" >enable</option>
              <option value="disable" selected>disable</option>
            </select>

	    <div id="game-wizard-advanced-return-btn" class="game-wizard-advanced-return-btn button">accept</div>

	</div>

            <div id="game-wizard-advanced-box" class="game-wizard-advanced-box" style="display:block;padding-left:20px;">

	      <style type="text/css">li { list-style: none; } .saito-select { margin-bottom: 10px; margin-top:5px; } label { text-transform: uppercase; } .removecards { grid-gap: 0.1em; } .list-header { font-weight: bold; font-size:1.5em; margin-top:0px; margin-bottom:10px; margin-left: 15px; text-transform: uppercase; } </style>
              <div class="list-header">remove cards:</div>
              <ul id="removecards" class="removecards">
              <li><input class="remove_card" type="checkbox" name="asia" /> Asia Scoring</li>
              <li><input class="remove_card" type="checkbox" name="europe" /> Europe Scoring</li>
              <li><input class="remove_card" type="checkbox" name="mideast" /> Middle-East Scoring</li>
              <li><input class="remove_card" type="checkbox" name="duckandcover" /> Duck and Cover</li>
              <li><input class="remove_card" type="checkbox" name="fiveyearplan" /> Five Year Plan</li>
              <li><input class="remove_card" type="checkbox" name="socgov" /> Socialist Governments</li>
              <li><input class="remove_card" type="checkbox" name="fidel" /> Fidel</li>
              <li><input class="remove_card" type="checkbox" name="vietnamrevolts" /> Vietnam Revolts</li>
              <li><input class="remove_card" type="checkbox" name="blockade" /> Blockade</li>
              <li><input class="remove_card" type="checkbox" name="koreanwar" /> Korean War</li>
              <li><input class="remove_card" type="checkbox" name="romanianab" /> Romanian Abdication</li>
              <li><input class="remove_card" type="checkbox" name="arabisraeli" /> Arab Israeli War</li>
              <li><input class="remove_card" type="checkbox" name="comecon" /> Comecon</li>
              <li><input class="remove_card" type="checkbox" name="nasser" /> Nasser</li>
              <li><input class="remove_card" type="checkbox" name="warsawpact" /> Warsaw Pact</li>
              <li><input class="remove_card" type="checkbox" name="degaulle" /> De Gaulle Leads France</li>
              <li><input class="remove_card" type="checkbox" name="naziscientist" /> Nazi Scientists Captured</li>
              <li><input class="remove_card" type="checkbox" name="truman" /> Truman</li>
              <li><input class="remove_card saito_edition" type="checkbox" name="olympic" /> Olympic Games</li>
              <li><input class="remove_card" type="checkbox" name="nato" /> NATO</li>
              <li><input class="remove_card" type="checkbox" name="indreds" /> Independent Reds</li>
              <li><input class="remove_card" type="checkbox" name="marshall" /> Marshall Plan</li>
              <li><input class="remove_card" type="checkbox" name="indopaki" /> Indo-Pakistani War</li>
              <li><input class="remove_card" type="checkbox" name="containment" /> Containment</li>
              <li><input class="remove_card" type="checkbox" name="cia" /> CIA Created</li>
              <li><input class="remove_card" type="checkbox" name="usjapan" /> US/Japan Defense Pact</li>
              <li><input class="remove_card" type="checkbox" name="suezcrisis" /> Suez Crisis</li>
              <li><input class="remove_card" type="checkbox" name="easteuropean" /> East European Unrest</li>
              <li><input class="remove_card" type="checkbox" name="decolonization" /> Decolonization</li>
              <li><input class="remove_card" type="checkbox" name="redscare" /> Red Scare</li>
              <li><input class="remove_card" type="checkbox" name="unintervention" /> UN Intervention</li>
              <li><input class="remove_card" type="checkbox" name="destalinization" /> Destalinization</li>
              <li><input class="remove_card" type="checkbox" name="nucleartestban" /> Nuclear Test Ban Treaty</li>
              <li><input class="remove_card" type="checkbox" name="formosan" /> Formosan Resolution</li>
              <li><input class="remove_card optional_edition" type="checkbox" name="defectors" /> Defectors</li>
              <li><input class="remove_card optional_edition " type="checkbox" name="specialrelation" /> Special Relationship</li>
              <li><input class="remove_card optional_edition" type="checkbox" name="cambridge" /> The Cambridge Five</li>
              <li><input class="remove_card optional_edition" type="checkbox" name="norad" /> NORAD</li>
            </ul>
            <ul class="removecards" style="clear:both;margin-top:13px">
              <li><input class="remove_card" type="checkbox" name="brushwar" /> Brush War</li>
              <li><input class="remove_card" type="checkbox" name="camerica" /> Central America Scoring</li>
              <li><input class="remove_card" type="checkbox" name="seasia" /> Southeast Asia Scoring</li>
              <li><input class="remove_card" type="checkbox" name="armsrace" /> Arms Race</li>
              <li><input class="remove_card" type="checkbox" name="cubanmissile" /> Cuban Missile Crisis</li>
              <li><input class="remove_card" type="checkbox" name="nuclearsubs" /> Nuclear Subs</li>
              <li><input class="remove_card" type="checkbox" name="quagmire" /> Quagmire</li>
              <li><input class="remove_card" type="checkbox" name="saltnegotiations" /> Salt Negotiations</li>
              <li><input class="remove_card" type="checkbox" name="beartrap" /> Bear Trap</li>
              <li><input class="remove_card saito_edition" type="checkbox" name="summit" /> Summit</li>
              <li><input class="remove_card" type="checkbox" name="howilearned" /> How I Learned to Stop Worrying</li>
              <li><input class="remove_card" type="checkbox" name="junta" /> Junta</li>
              <li><input class="remove_card" type="checkbox" name="kitchendebates" /> Kitchen Debates</li>
              <li><input class="remove_card" type="checkbox" name="missileenvy" /> Missile Envy</li>
              <li><input class="remove_card" type="checkbox" name="wwby" /> We Will Bury You</li>
              <li><input class="remove_card" type="checkbox" name="brezhnev" /> Brezhnev Doctrine</li>
              <li><input class="remove_card" type="checkbox" name="portuguese" /> Portuguese Empire Crumbles</li>
              <li><input class="remove_card" type="checkbox" name="southafrican" /> South African Unrest</li>
              <li><input class="remove_card" type="checkbox" name="allende" /> Allende</li>
              <li><input class="remove_card" type="checkbox" name="willybrandt" /> Willy Brandt</li>
              <li><input class="remove_card" type="checkbox" name="muslimrevolution" /> Muslim Revolution</li>
              <li><input class="remove_card" type="checkbox" name="abmtreaty" /> ABM Treaty</li>
              <li><input class="remove_card" type="checkbox" name="culturalrev" /> Cultural Revolution</li>
              <li><input class="remove_card" type="checkbox" name="flowerpower" /> Flower Power</li>
              <li><input class="remove_card" type="checkbox" name="u2" /> U-2 Incident</li>
              <li><input class="remove_card" type="checkbox" name="opec" /> OPEC</li>
              <li><input class="remove_card" type="checkbox" name="lonegunman" /> Lone Gunman</li>
              <li><input class="remove_card" type="checkbox" name="colonial" /> Colonial</li>
              <li><input class="remove_card" type="checkbox" name="panamacanal" /> Panama Canal</li>
              <li><input class="remove_card" type="checkbox" name="campdavid" /> Camp David Accords</li>
              <li><input class="remove_card" type="checkbox" name="puppet" /> Puppet Governments</li>
              <li><input class="remove_card" type="checkbox" name="grainsales" /> Grain Sales to Soviets</li>
              <li><input class="remove_card" type="checkbox" name="johnpaul" /> John Paul</li>
              <li><input class="remove_card" type="checkbox" name="deathsquads" /> Death Squads</li>
              <li><input class="remove_card" type="checkbox" name="oas" /> OAS Founded</li>
              <li><input class="remove_card" type="checkbox" name="nixon" /> Nixon Plays the China Card</li>
              <li><input class="remove_card" type="checkbox" name="sadat" /> Sadat Expels Soviets</li>
              <li><input class="remove_card" type="checkbox" name="shuttle" /> Shuttle Diplomacy</li>
              <li><input class="remove_card" type="checkbox" name="voiceofamerica" /> Voice of America</li>
              <li><input class="remove_card" type="checkbox" name="liberation" /> Liberation Theology</li>
              <li><input class="remove_card" type="checkbox" name="ussuri" /> Ussuri River Skirmish</li>
              <li><input class="remove_card" type="checkbox" name="asknot" /> Ask Not What Your Country Can Do For You</li>
              <li><input class="remove_card" type="checkbox" name="alliance" /> Alliance for Progress</li>
              <li><input class="remove_card" type="checkbox" name="africa" /> Africa Scoring</li>
              <li><input class="remove_card" type="checkbox" name="onesmallstep" /> One Small Step</li>
              <li><input class="remove_card" type="checkbox" name="samerica" /> South America</li>
              <li><input class="remove_card optional_edition" type="checkbox" name="che" /> Che</li>
              <li><input class="remove_card optional_edition" type="checkbox" name="tehran" /> Our Man in Tehran</li>
            </ul>
            <ul class="removecards" style="clear:both;margin-top:13px">
              <li><input class="remove_card" type="checkbox" name="iranianhostage" /> Iranian Hostage Crisis</li>
              <li><input class="remove_card" type="checkbox" name="ironlady" /> The Iron Lady</li>
              <li><input class="remove_card" type="checkbox" name="reagan" /> Reagan Bombs Libya</li>
              <li><input class="remove_card" type="checkbox" name="starwars" /> Star Wars</li>
              <li><input class="remove_card" type="checkbox" name="northseaoil" /> North Sea Oil</li>
              <li><input class="remove_card" type="checkbox" name="reformer" /> The Reformer</li>
              <li><input class="remove_card" type="checkbox" name="marine" /> Marine Barracks Bombing</li>
              <li><input class="remove_card" type="checkbox" name="KAL007" /> Soviets Shoot Down KAL-007</li>
              <li><input class="remove_card" type="checkbox" name="glasnost" /> Glasnost</li>
              <li><input class="remove_card" type="checkbox" name="ortega" /> Ortega Elected in Nicaragua</li>
              <li><input class="remove_card" type="checkbox" name="terrorism" /> Terrorism</li>
              <li><input class="remove_card" type="checkbox" name="ironcontra" /> Iran Contra Scandal</li>
              <li><input class="remove_card" type="checkbox" name="chernobyl" /> Chernobyl</li>
              <li><input class="remove_card" type="checkbox" name="debtcrisis" /> Latin American Debt Crisis</li>
              <li><input class="remove_card" type="checkbox" name="teardown" /> Tear Down this Wall</li>
              <li><input class="remove_card" type="checkbox" name="evilempire" /> An Evil Empire</li>
              <li><input class="remove_card" type="checkbox" name="aldrichames" /> Aldrich Ames Remix</li>
              <li><input class="remove_card" type="checkbox" name="pershing" /> Pershing II Deployed</li>
              <li><input class="remove_card" type="checkbox" name="wargames" /> Wargames</li>
              <li><input class="remove_card" type="checkbox" name="solidarity" /> Solidarity</li>
              <li><input class="remove_card optional_edition" type="checkbox" name="iraniraq" /> Iran-Iraq War</li>
              <li><input class="remove_card optional_edition" type="checkbox" name="yuri" /> Yuri and Samantha</li>
              <li><input class="remove_card optional_edition" type="checkbox" name="awacs" /> AWACS Sale to Saudis</li>
            </ul>

            <div class="list-header">add cards:</div>
            <ul id="removecards" class="removecards">
              <li><input class="remove_card saito_edition" type="checkbox" name="culturaldiplomacy" /> Cultural Diplomacy (Early-War)</li>
              <li><input class="remove_card saito_edition" type="checkbox" name="handshake" /> Handshake in Space (Mid-War)</li>
              <li><input class="remove_card saito_edition" type="checkbox" name="rustinredsquare" /> Rust Lands in Red Square (Late-War)</li>
              <li><input class="remove_card" type="checkbox" name="gouzenkoaffair" /> Gouzenko Affair (Early-War)</li>
              <li><input class="remove_card" type="checkbox" name="poliovaccine" /> Polio Vaccine (Early-War)</li>
              <li><input class="remove_card saito_edition" type="checkbox" name="berlinagreement" /> 1971 Berlin Agreement (Mid-War)</li>
              <li><input class="remove_card endofhistory_edition" type="checkbox" name="peronism" /> Peronism (Early-War)</li>
              <li><input class="remove_card endofhistory_edition" type="checkbox" name="manwhosavedtheworld" /> The Man Who Saved the World (Mid-War)</li>
              <li><input class="remove_card endofhistory_edition" type="checkbox" name="breakthroughatlopnor" /> Breakthrough at Lop Nor (Mid-War)</li>
              <li><input class="remove_card endofhistory_edition" type="checkbox" name="nationbuilding" /> Nation Building (Mid-War)</li>
              <li><input class="remove_card endofhistory_edition" type="checkbox" name="greatsociety" /> Great Society (Mid-War)</li>
              <li><input class="remove_card endofhistory_edition" type="checkbox" name="perestroika"  /> Perestroika (Late-War)</li>
              <li><input class="remove_card endofhistory_edition" type="checkbox" name="eurocommunism" /> Eurocommunism (Mid-War)</li>
              <li><input class="remove_card endofhistory_edition" type="checkbox" name="inftreaty" /> INF Treaty (Late-War)</li>
              <li><input class="remove_card coldwarcrazies_edition" type="checkbox" name="communistrevolution" /> Communist Revolution (Early-War)</li>
            </div>

      </div>
    </div>
          `;

  }


  returnGameRulesHTML(){
    return `<div class="rules-overlay">
    <h1>Twilight Struggle</h1>
    <p>Players take the roles of the US and the USSR and vie for global dominance over ten turns that cover the cold war. Twilight Struggle is a card-based board game. Most cards describes an EVENT, which may be associated with the US, the USSR, or neutral. Every card has an OPERATIONS value. Some SCORING cards trigger a pause to score the current board state. The board show the amount of influence each player has in various countries across the globe. Every country has a STABILITY number and lines on the board show adjacency between countries.</p>
    <p>Each turn begins with the selection of a HEADLINE, wherein both players select one card from their hand to play first. The card with the higher OPERATIONS value takes effect first, or in the event of a tie the US player's card goes into effect first. A HEADLINE card must be chosen and played, regardless of whether the event helps the player or their opponent.</p>
    <p>After the HEADLINE, the players alternate playing cards for 6-7 ACTION ROUNDS. The USSR always starts. Cards may be played for EVENTS or OPERATIONS. Playing a card associated with one's opponent (for OPERATION points) still triggers the EVENT as if the opponent had played it themselves. OPERATIONS may be used to place INFLUENCE markers, make REALIGNMENT rolls, attempt COUPS, or advance in the SPACE RACE. </p>
    <dl>
    <dt>INFLUENCE</dt><dd>Influence markers are placed on countries with friendly influence or their immediate neighbors. It costs 1 OP to place influence in a friendly or uncontrolled country, and 2 OP to place influence in an enemy controlled country. To control a country, your influence must exceed your opponent's by at least the STABILITY number of the country.</dd>
    <dt>REALIGNMENT</dt><dd>Realignment rolls reduce enemy influence in a country regardless of whether the player has any influence in the country or its neighbors. It costs 1 OP per roll. Both players roll and the high roller can remove the difference in die values of influence in the target country. Players get +1 if the target country borders their SUPERPOWER, +1 if they have more influence in the target country, and +1 for each adjacent controlled country.</dd>
    <dt>COUP</dt><dd>A Coup is an attempt to replace the enemy's influence in a target country with that of your own. Roll the dice and add the OP of the card and subtract double the STABILITY number of the country. The result, if positive, is a successful coup and the player may first remove that many enemy influence then add any remaining amount of friendly influence.</dd>
    <dt>SPACE RACE</dt><dd>Players gain victory points and special abilities for advancing in the SPACE RACE. A player may only attempt to advance in the SPACE RACE once per turn and success depends upon a dice roll. The player must DISCARD a card with a minimum OPERATIONS values. Unlike other actions, the EVENT of the discarded card does not get triggered.</dd>
    </dl>
    <h3>DEFCON STATUS</h3>
    <p>If the DEFCON level (a measure of threat of nuclear war) ever reaches 1, the game immediately ends and the PHASING player (who plays the card) loses. DEFCON level degrades for any COUP in a BATTLEGROUND country. Any DEFCON level below 5 will place geographic restrictions on where COUPS or REALIGNMENT rolls may be attempted. DEFCON is improved at the beginning of each turn. Many Events will improve or degrade the DEFCON level.</p>
    <h3>MILITARY OPERATIONS</h3>
    <p>Each player must conduct a minimum amount of military operations per turn (determined by DEFCON), or risk losing VP. Wars and COUPS are military operations. The OP spent on the COUP or the amount specified in the text of the war EVENT card. </p>
    <h3>CHINA CARD</h3>
    <p>The USSR starts with the China card, which may be played like any regular card. When played, the China card is passed to the opponent who may use it in the next turn. </p>
    <h3>SCORING</h3>
    <p>Scoring is conducted regionally when a SCORING card is played. SCORING cards must be played at some point during the turn if in your hand. The card specifies the number of VP for each of the possible conditions:</p>
    <ul>
    <li>PRESENCE: You control at least one country in the region.</li>
    <li>DOMINATION: You control more countries and more Battleground countries than your opponent in the region</li>
    <li>CONTROL: You control more countries than your opponent and all of the Battleground countries.</li>
    </ul>
    <p>Players are also awarded +1 VP for each Battleground country they control in the region and +1 VP for each controlled country adjacent to the enemy superpower.</p>
    <p>If a player ever reaches a 20 VP lead over the opponent, then they win the game. </p>
    </div>`;
  }

  settleVPOutstanding() {

    if (this.game.state.vp_outstanding != 0) {
      this.game.state.vp += this.game.state.vp_outstanding;
    }
    this.game.state.vp_outstanding = 0;
    this.updateVictoryPoints();

  }


  
  returnFormattedGameOptions(options) {
    let new_options = {};
    for (var index in options) {
      if (index == "player1") {
        if (options[index] == "random") {
          new_options[index] = options[index];
        } else {
	  if (options[index] === "ussr") {
	    new_options[index] = "ussr";
	  } else {
	    new_options[index] = "us";
	  }
        }
      } else {
        new_options[index] = options[index]
      }
    }
    return new_options;
  }





  

  displayChinaCard() {

    $('.china_card_status').removeClass('china_card_status_us_facedown');
    $('.china_card_status').removeClass('china_card_status_us_faceup');
    $('.china_card_status').removeClass('china_card_status_ussr_facedown');
    $('.china_card_status').removeClass('china_card_status_ussr_faceup');

    let x = this.whoHasTheChinaCard();

    if (x === "ussr") {
      if (this.game.state.events.china_card_facedown == 0) {
        $('.china_card_status').addClass('china_card_status_ussr_faceup');
      } else {
        $('.china_card_status').addClass('china_card_status_ussr_facedown');
      }
    } else {
      if (this.game.state.events.china_card_facedown == 0) {
        $('.china_card_status').addClass('china_card_status_us_faceup');
      } else {
        $('.china_card_status').addClass('china_card_status_us_facedown');
      }
    }

  }




  /////////////////
  // Play Events //
  /////////////////
  //
  // the point of this function is either to execute events directly
  // or permit the relevant player to translate them into actions
  // that can be directly executed by UPDATE BOARD.
  //
  // this function returns 1 if we can continue, or 0 if we cannot
  // in the handleGame loop managing the events / turns that are
  // queued up to go.
  //
  playEvent(player, card) {

    if (this.game.deck[0].cards[card] != undefined) {
      this.updateStatus(`<div class='status-message' id='status-message'>${player.toUpperCase()} triggers ${this.cardToText(card)}</div>`);
      this.attachCardboxEvents();
    } else {
      //
      // event already run - sync loading error
      //
      console.log("sync loading error -- playEvent on card: " + card);
      return 1;
    }

    let i_played_the_card = (this.playerRoles[this.game.player] == player);




    //
    // ABM Treaty
    //
    if (card == "abmtreaty") {

//      this.game.state.back_button_cancelled = 1;
      this.updateStatus('<div class="status-message" id="status-message">' + player.toUpperCase() + " <span>plays ABM Treaty</span></div>");

      this.updateLog("DEFCON increases by 1");

      this.game.state.defcon++;
      if (this.game.state.defcon > 5) { this.game.state.defcon = 5; }
      this.updateDefcon();

      this.game.queue.push("resolve\tabmtreaty");
      this.game.queue.push("ops\t"+player+"\tabmtreaty\t4");
      
      return 1;
    }





    if (card == "africa") {
      let vp_adjustment = this.calculateScoring("africa");
      this.showScoreOverlay(card, vp_adjustment);
      let total_vp = vp_adjustment.us.vp - vp_adjustment.ussr.vp;
      this.game.state.vp += total_vp;
      this.updateLog("<span>Africa:</span> " + total_vp + " <span>VP</span>");

      // stats
      if (player == "us") { this.game.state.stats.us_scorings++; }
      if (player == "ussr") { this.game.state.stats.ussr_scorings++; }

      this.updateVictoryPoints();
      return 1;
    }



    //
    // Aldrich Ames Remix
    //
    if (card == "aldrichames") {

      this.game.state.events.aldrich = 1;

      if (this.game.player == 1) {
        return 0;
      }
      if (this.game.player == 2) {
        //this.updateStatus("<div class='status-message' id='status-message'>USSR is playing Aldrich Ames</div>");
        this.addMove("resolve\taldrichames");

        if (this.game.deck[0].hand.length < 1) {
          this.addMove("NOTIFY\tUS has no cards to reveal");
          this.endTurn();
        }

        let cards_to_reveal = 0;
	      let revealed = "";

        for (let i = 0; i < this.game.deck[0].hand.length; i++) {
          if (this.game.deck[0].hand[i] !== "china" && this.game.deck[0].hand[i] !== this.game.state.headline_opponent_card && this.game.deck[0].hand[i] !== this.game.state.headline_card) {
           cards_to_reveal++; 
           if (revealed != "") { revealed += ", "; }
            revealed += this.game.deck[0].cards[this.game.deck[0].hand[i]].name;
            this.addMove(this.game.deck[0].hand[i]);
          }
        }
        if (cards_to_reveal == 0) {
          this.addMove("NOTIFY\tUS has no cards to reveal");
          this.endTurn();
        } else {
          this.addMove("aldrich\tus\t"+cards_to_reveal);
          this.addMove("NOTIFY\tUS holds: "+revealed);
          this.endTurn();
        }


      }
      return 0;
    }






    //
    // Allende
    //
    if (card == "allende") {
      this.placeInfluence("chile", 2, "ussr");

      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR plays ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS triggers ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }





    //
    // Alliance for Progress
    //
    if (card == "alliance") {

      let us_bonus = 0;

      if (this.isControlled("us", "mexico") == 1)     { us_bonus++; }
      if (this.isControlled("us", "cuba") == 1)       { us_bonus++; }
      if (this.isControlled("us", "panama") == 1)     { us_bonus++; }
      if (this.isControlled("us", "chile") == 1)      { us_bonus++; }
      if (this.isControlled("us", "argentina") == 1)  { us_bonus++; }
      if (this.isControlled("us", "brazil") == 1)     { us_bonus++; }
      if (this.isControlled("us", "venezuela") == 1)  { us_bonus++; }

      this.game.state.vp += us_bonus;
      this.updateVictoryPoints();
      this.updateLog("<span>US VP bonus is:</span> " + us_bonus);
      
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }
      return 1;

    }





    //////////////////////
    // Arab Israeli War //
    //////////////////////
    if (card == "arabisraeli") {

      if (this.game.state.events.campdavid == 1) {
        this.updateLog("Arab-Israeli conflict cancelled by Camp David Accords");
        return 1;
      }

      let target = 4;
      let modifications = 0;
      if (this.isControlled("us", "israel") == 1) { modifications++; }
      if (this.isControlled("us", "egypt") == 1) { modifications++; }
      if (this.isControlled("us", "jordan") == 1) { modifications++; }
      if (this.isControlled("us", "lebanon") == 1) { modifications++; }
      if (this.isControlled("us", "syria") == 1) { modifications++; }

      let winner = "";
      let roll = this.rollDice(6);
      this.updateLog(`${player.toUpperCase()} rolls: ${roll}, adjusted: ${roll-modifications}`);
      //this.updateLog("<span>" + player.toUpperCase()+"</span> <span>modified:</span> "+(roll-modified));

      if (roll - modifications >= target) {
        winner = "Pan-Arab Coalition wins"
        this.updateLog("USSR wins the Arab-Israeli War");
        if (this.countries['israel'].us > 0){
          this.placeInfluence("israel", this.countries['israel'].us, "ussr");
          this.removeInfluence("israel", this.countries['israel'].us, "us");  
        }
        this.updateLog("USSR receives 2 VP from Arab-Israeli War");
        this.game.state.vp -= 2;
        this.updateVictoryPoints();
      } else {
        winner = "Israel defends itself";
        this.updateLog("US wins the Arab-Israeli War");
      }
        this.game.state.milops_ussr += 2;
        this.updateMilitaryOperations();
        this.showWarOverlay(card, winner, roll, modifications);

      return 1;
    }






    //
    // Arms Race
    //
    if (card == "armsrace") {
      
      let bonus = 0;

      if (player == "us") {
        if (this.game.state.milops_us > this.game.state.milops_ussr) {
          bonus = 1;
          this.game.state.vp += 1;
          if (this.game.state.milops_us >= this.game.state.defcon) {
            this.game.state.vp += 2;
            bonus = 3;
          }
        }  
      } else {
        if (this.game.state.milops_ussr > this.game.state.milops_us) {
          bonus = 1;
          this.game.state.vp -= 1;
          if (this.game.state.milops_ussr >= this.game.state.defcon) {
            bonus = 3;
            this.game.state.vp -= 2;
          }
        }
      }
      this.updateVictoryPoints();
      this.updateLog(`${player.toUpperCase()} gains ${bonus} VP from ${this.cardToText(card)}`);
      this.displayModal(this.cardToText(card), `${player.toUpperCase()} gains ${bonus} VP`);
      if (!i_played_the_card){
        this.game.queue.push(`ACKNOWLEDGE\t${player.toUpperCase()} plays ${this.cardToText(card)}.`);
      }
      
      return 1;

    }




    if (card == "asia") {
      let vp_adjustment = this.calculateScoring("asia");
      this.showScoreOverlay(card, vp_adjustment);
      let total_vp = vp_adjustment.us.vp - vp_adjustment.ussr.vp;
      this.game.state.vp += total_vp;
      this.updateLog("<span>Asia:</span> " + total_vp + " <span>VP</span>");
      this.updateVictoryPoints();

      // stats
      if (player == "us") { this.game.state.stats.us_scorings++; }
      if (player == "ussr") { this.game.state.stats.ussr_scorings++; }

      return 1;
    }


    //
    // US may discard any number of cards and replace them with a new draw
    if (card == "asknot") {

      if (this.game.player == 1) {
        //this.updateStatus("<div class='status-message' id='status-message'>Waiting for US to play Ask Not What Your Country Can Do For You</div>");
        return 0;
      }
      if (this.game.player == 2) {

        var twilight_self = this;
        let cards_discarded = 0;

        let user_message = `${this.cardToText(card)} -- Select cards to discard:`;
        let cardList = [];
        for (let i = 0; i < this.game.deck[0].hand.length; i++) {
          let card_in_hand = this.game.deck[0].hand[i];
          if (card_in_hand != "china" && card_in_hand != this.game.state.headline_opponent_card && card_in_hand != this.game.state.headline_card) {
            //html += '<li class="card card_'+this.game.deck[0].hand[i]+'" id="'+this.game.deck[0].hand[i]+'">'+this.game.deck[0].cards[this.game.deck[0].hand[i]].name+'</li>';
            cardList.push(card_in_hand);
          }
        }

        if (cardList.length == 0) {
          twilight_self.addMove("notify\tUS has no cards available to discard");
          twilight_self.endTurn();
          return;
        }

        cardList.push("finished");
        //html += '<span class="card dashed nocard" id="finished">done discarding</span></ul>';

        twilight_self.updateStatusAndListCards(user_message, cardList, false);
        twilight_self.addMove("resolve\tasknot");
        twilight_self.attachCardboxEvents(function(action2) {

          if (action2 == "finished") {

      	    //
            // if Aldrich Ames is active, US must reveal cards
            //
            if (twilight_self.game.state.events.aldrich == 1) {
              twilight_self.addMove("aldrichreveal\tus");
            }

            //
      	    // cards to deal first
      	    //
      	    let cards_to_deal_before_reshuffle = cards_discarded;
	    
            if (cards_to_deal_before_reshuffle > twilight_self.game.deck[0].crypt.length) {
      	      cards_to_deal_before_reshuffle = twilight_self.game.deck[0].crypt.length;
      	      let cards_to_deal_after_reshuffle = cards_discarded - cards_to_deal_before_reshuffle;
              if (cards_to_deal_after_reshuffle > 0) {
                twilight_self.addMove("DEAL\t1\t2\t"+cards_to_deal_after_reshuffle);
              }

              let discarded_cards = twilight_self.returnDiscardedCards();

              //
              // shuttle diplomacy
              //
              if (this.game.state.events.shuttlediplomacy == 1) {
                if (discarded_cards['shuttle'] != undefined) {
                  delete discarded_cards['shuttle'];
                }
              }


              if (Object.keys(discarded_cards).length > 0) {

                //
                // shuffle in discarded cards
                //
                twilight_self.addMove("SHUFFLE\t1");
                twilight_self.addMove("DECKRESTORE\t1");
                twilight_self.addMove("DECKENCRYPT\t1\t2");
                twilight_self.addMove("DECKENCRYPT\t1\t1");
                twilight_self.addMove("DECKXOR\t1\t2");
                twilight_self.addMove("DECKXOR\t1\t1");
                twilight_self.addMove("flush\tdiscards"); // opponent should know to flush discards as we have
                twilight_self.addMove("DECK\t1\t"+JSON.stringify(discarded_cards));
                twilight_self.addMove("DECKBACKUP\t1");
                twilight_self.addMove("NOTIFY\tcards remaining: " + twilight_self.game.deck[0].crypt.length);
                twilight_self.addMove("NOTIFY\tShuffling discarded cards back into the deck...");

              }
      	    }

            twilight_self.addMove("DEAL\t1\t2\t"+cards_to_deal_before_reshuffle);
            twilight_self.endTurn();

          } else {
            if (this.game.deck[0].hand.includes(action2)){
              cards_discarded++;
              $(`#${action2}.card`).hide();
              twilight_self.removeCardFromHand(action2);
              twilight_self.addMove("discard\tus\t"+action2);  
            }
          }
        });

      }

      return 0;

    }



    //
    // AWACS Sale to Saudis
    //
    if (card == "awacs") {
      this.game.state.events.awacs = 1; //Prevent Muslim Revolution
      this.placeInfluence("saudiarabia", 2, "us");

      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }

      return 1;
    }




    //
    // Bear Trap
    //
    if (card == "beartrap") {
      this.game.state.events.beartrap = 1;
       if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }




    //////////////
    // Blockade //
    //////////////
    if (card == "blockade") {

      //
      // COMMUNITY
      //
      if (this.game.state.events.optional.berlinagreement == 1) {
        this.updateLog(`${this.cardToText("berlinagreement")} prevents ${this.cardToText("blockade")}.`);
        return 1;
      }


      if (this.game.player == 1) {
        this.updateStatus(`<div class='status-message' id='status-message'>US is responding to ${this.cardToText(card)}</div>`);
        this.attachCardboxEvents();
        return 0;
      }
      if (this.game.player == 2) {

        this.addMove("resolve\tblockade");

        let twilight_self = this;
        
        let cards_to_discard = [];

        for (let i = 0; i < this.game.deck[0].hand.length; i++) {
          if (this.game.deck[0].hand[i] != "china") {
            let avops = this.modifyOps(this.game.deck[0].cards[this.game.deck[0].hand[i]].ops, this.game.deck[0].hand[i], "us", 0);
            if (avops >= 3) { 
              cards_to_discard.push(this.game.deck[0].hand[i]);
            }
          }
        }

        if (cards_to_discard.length == 0) {
          this.addMove("remove\tus\tus\twestgermany\t"+this.countries['westgermany'].us);
          this.addMove("NOTIFY\tUS loses all influence from West Germany");
          this.removeInfluence("westgermany", this.countries['westgermany'].us, "us");
          this.endTurn();
          this.updateStatus(`<div class='status-message' id='status-message'>${twilight_self.cardToText("blockade")} played: no cards available to discard.</div>`);
          return 0;
        }

        this.updateStatusWithOptions(`${this.cardToText(card)}:`,'<ul><li class="card" id="discard">discard 3 OP card</li><li class="card" id="remove">remove all US influence in W. Germany</li></ul>',false);
        twilight_self.attachCardboxEvents(function(action) {

          if (action == "discard") {
            
            twilight_self.updateStatusAndListCards("Choose a card to discard:",cards_to_discard,false);
            twilight_self.attachCardboxEvents(function(card) {
              twilight_self.removeCardFromHand(card);
              twilight_self.addMove(`NOTIFY\tUS discarded ${twilight_self.cardToText(card)} to resolve ${twilight_self.cardToText("blockade")}`);
              twilight_self.endTurn();
              return 0;
            });

          }
          if (action == "remove") {
            twilight_self.addMove("remove\tus\tus\twestgermany\t"+twilight_self.countries['westgermany'].us);
            twilight_self.addMove("NOTIFY\tUS loses all influence from West Germany");
            twilight_self.removeInfluence("westgermany", twilight_self.countries['westgermany'].us, "us");
            twilight_self.endTurn();
            twilight_self.updateStatus(`<div class='status-message' id='status-message'>${twilight_self.cardToText("blockade")}: lose all influence in West Germany.</div>`);
            return 0;
          }

        });

        return 0;
      }
    }




    //
    // Brezhnev Doctrine
    //
    if (card == "brezhnev") {
      this.game.state.events.brezhnev = 1;
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR plays ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS triggers ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }





    if (card == "brushwar") {

      let me = "ussr";
      let opponent = "us";
      if (this.game.player == 2) { opponent = "ussr"; me = "us"; }

      if (me != player) {
        let burned = this.rollDice(6);
        return 0;
      }
      if (me == player) {

        var twilight_self = this;
        twilight_self.playerFinishedPlacingInfluence();

        twilight_self.addMove("resolve\tbrushwar");
        twilight_self.updateStatus('<div class="status-message" id="status-message">Pick target for Brush War</div>');


        for (var i in twilight_self.countries) {

          if (twilight_self.countries[i].control <= 2) {

            let divname = "#" + i;

            $(divname).off();
            $(divname).on('click', function() {

              let c = $(this).attr('id');

              if (c === "italy" || c === "greece" || c === "spain" || c === "turkey") {
                if (twilight_self.game.state.events.nato == 1) {
                  if (twilight_self.isControlled("us", c) == 1) {
                    twilight_self.displayModal("NATO prevents Brush War in Europe");
                    return;
                  }
                }
              }

      
              let die = twilight_self.rollDice(6);
              let modifications = 0;

              for (let v = 0; v < twilight_self.countries[c].neighbours.length; v++) {
                if (twilight_self.isControlled(opponent, twilight_self.countries[c].neighbours[v]) == 1) {
                  modifications++;
                }
              }
              //Only check for legit (stability = 1 or 2) countries neighboring superpower
              if (twilight_self.game.player == 1 && c === "mexico") {
                 modifications++; 
              }
              if (twilight_self.game.player == 2 && c === "afghanistan") {
                modifications++; 
              }

              let winner = ""
              if (die >= 3 + modifications) {
                winner = twilight_self.countries[c].name + " is conquered!";
                let influence_change = 0;
                if (player == "us") {
                  influence_change = twilight_self.countries[c].ussr;
                } else {
                  influence_change = twilight_self.countries[c].us;
                }

                if (influence_change > 0){
                  twilight_self.addMove(`place\t${player}\t${player}\t${c}\t${influence_change}`);
                  twilight_self.addMove(`remove\t${player}\t${opponent}\t${c}\t${influence_change}`);
                  twilight_self.placeInfluence(c, influence_change, player);
                  twilight_self.removeInfluence(c, influence_change, opponent);
                }
                
                twilight_self.addMove(`milops\t${me}\t3`);
                if (twilight_self.game.state.events.flowerpower == 1) {
                  twilight_self.addMove(`vp\t${me}\t1\t1`);
                } else {
                  twilight_self.addMove(`vp\t${me}\t1`);
                }
                twilight_self.addMove("NOTIFY\tBrush War in "+twilight_self.countries[c].name+" succeeded.");
              } else {
                winner = twilight_self.countries[c].name + " repels an invasion!";
                if (me == "us") {
                  twilight_self.addMove("milops\tus\t3");
                } else {
                  twilight_self.addMove("milops\tussr\t3");
                }
                twilight_self.addMove("NOTIFY\tBrush War in "+twilight_self.countries[c].name+" failed.");
              }

              twilight_self.addMove("NOTIFY\t"+player.toUpperCase()+`rolls for Brush War: ${die}, adjusted: ${die-modifications}`);  
              twilight_self.addMove(`war\t${card}\t${winner}\t${die}\t${modifications}\t${player}`);
              twilight_self.endTurn();


            });
          }
        }
      }
      return 0;
    }



    if (card == "cambridge") {

      if (this.game.state.round > 7) {
        this.updateLog("<span>The Cambridge Five cannot be played as an event in Late Wa</span>");
        this.updateStatus("<div class='status-message' id='status-message'><span>The Cambridge Five cannot be played as an event in Late War</span></div>");
        return 1;
      }

      if (this.game.player == 1) {
        //this.updateStatus("<div class='status-message' id='status-message'><span>USSR is playing The Cambridge Five (fetching scoring cards in US hand)</span></div>");
        return 0;
      }

      if (this.game.player == 2) {

        this.addMove("resolve\tcambridge");

        let scoring_cards = "", scoring_alert = "";
        
        for (let i = 0; i < this.game.deck[0].hand.length; i++) {
          
            if (this.game.deck[0].cards[this.game.deck[0].hand[i]]?.scoring == 1) {
              if (this.game.deck[0].hand[i] != this.game.state.headline_opponent_card && this.game.deck[0].hand[i] != this.game.state.headline_card) {
                if (scoring_cards.length > 0) { scoring_cards += ", "; scoring_alert += "\t"; }
                scoring_cards += '<span>' + this.game.deck[0].hand[i] + '</span>';
                scoring_alert += this.game.deck[0].hand[i];
              }
            }
        }

        let revealed = "", keys = "";
        for (let i = 0; i < this.game.deck[0].hand.length; i++) { //Search US hand
          if (this.game.deck[0].cards[this.game.deck[0].hand[i]]?.scoring == 1) { //For score cards
            if (this.game.deck[0].hand[i] != this.game.state.headline_opponent_card 
              && this.game.deck[0].hand[i] != this.game.state.headline_card) { //Not played as a headline
         
              if (revealed.length > 0) { 
                revealed += ", "; 
                keys += " ";
              }
              revealed += this.game.deck[0].cards[this.game.deck[0].hand[i]].name;
              keys += this.game.deck[0].hand[i];
            }
          }
        }

        if (revealed.length == 0) {

          this.addMove("NOTIFY\tUS does not have any scoring cards");
          this.endTurn();

        } else {
          let scoring_alert  = "cambridge\t" + keys.replaceAll(" ", "\t");
          this.addMove(scoring_alert);
          this.addMove("showhand\t2\t"+keys);
          this.addMove("NOTIFY\tUS has scoring cards for: " + revealed);
          this.endTurn();
          this.updateStatus(`<div class='status-message' id='status-message'>USSR is placing influence for ${this.cardToText(card)}</div>`);
        }

      }

      return 0;
    }




    //
    // Camp David
    //
    if (card == "campdavid") {

      this.game.state.events.campdavid = 1; //Prevents Arab-Isreali War

      this.updateLog("US gets 1 VP for Camp David Accords");

      this.game.state.vp += 1;
      this.updateVictoryPoints();

      this.placeInfluence("israel", 1, "us");
      this.placeInfluence("egypt", 1, "us");
      this.placeInfluence("jordan", 1, "us");
      
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }






    if (card == "camerica") {
      let vp_adjustment = this.calculateScoring("camerica");
      this.showScoreOverlay(card, vp_adjustment);
      let total_vp = vp_adjustment.us.vp - vp_adjustment.ussr.vp;
      this.game.state.vp += total_vp;
      this.updateLog("<span>Central America:</span> " + total_vp + " <span>VP</span>");

      // stats
      if (player == "us") { this.game.state.stats.us_scorings++; }
      if (player == "ussr") { this.game.state.stats.ussr_scorings++; }


      this.updateVictoryPoints();
      return 1
    }




      
    //
    // Che
    //
    if (card == "che") {
      
      let twilight_self = this;
      let valid_targets = 0;
      let couppower = 3;
      
      if (player == "us") { couppower = this.modifyOps(3,"che","us"); }
      if (player == "ussr") { couppower = this.modifyOps(3,"che","ussr"); } 
       
      for (var c in this.countries) {
        
        if ( twilight_self.countries[c].bg == 0 && (twilight_self.countries[c].region == "africa" || twilight_self.countries[c].region == "camerica" || twilight_self.countries[c].region == "samerica") && twilight_self.countries[c].us > 0 ) {
          valid_targets++;
          $("#"+c).addClass("easterneurope");
        }
      }

      if (valid_targets == 0) {
        this.updateLog("No valid targets for Che");
        return 1;
      } 
        
      if (this.game.player == 2) {
        //this.updateStatus(`<div class='status-message' id='status-message'>Waiting for USSR to play ${this.cardToText(card)}</div>`);
        return 0;
      }   
      if (this.game.player == 1) {
          
        let user_message = `${this.cardToText(card)} takes effect. Pick first target for coup:`;
        let html = '<ul><li class="card" id="skipche">or skip coup</li></ul>';
            
        twilight_self.updateStatusWithOptions(user_message, html, false);
        twilight_self.attachCardboxEvents(function(action2) {
          if (action2 == "skipche") {
            twilight_self.addMove("resolve\tche");
            twilight_self.endTurn();
            twilight_self.updateStatus("<div class='status-message' id='status-message'>Skipping Che coups...</div>");
          }
        });
          
        $(".easterneurope").on('click', function() {
          let c = $(this).attr('id');
          twilight_self.addMove("resolve\tche");
          twilight_self.addMove("checoup\tussr\t"+c+"\t"+couppower);
          twilight_self.addMove("NOTIFY\tChe launches coup in "+twilight_self.countries[c].name);
          twilight_self.addMove("milops\tussr\t"+couppower);
          twilight_self.endTurn();
          twilight_self.playerFinishedPlacingInfluence(player);
        }); 
      }
      return 0;
    }     
          
          
          



    if (card == "chernobyl") {

      if (this.game.player == 1) {
        //this.updateStatus("<div class='status-message' id='status-message'>US is playing Chernobyl</div>");
        return 0;
      }

      let html = `<ul>
                  <li class="card" id="asia">Asia</li>
                  <li class="card" id="europe">Europe</li>
                  <li class="card" id="africa">Africa</li>
                  <li class="card" id="camerica">Central America</li>
                  <li class="card" id="samerica">South America</li>
                  <li class="card" id="mideast">Middle-East</li>
                  </ul>`;

      this.updateStatusWithOptions("Chernobyl triggered. Designate region to prohibit USSR placement of influence from OPS:",html,false);

      let twilight_self = this;
      twilight_self.attachCardboxEvents(function(action2) {

        twilight_self.addMove("resolve\tchernobyl");
        twilight_self.addMove("chernobyl\t"+action2);
        twilight_self.addMove("NOTIFY\tUS restricts placement in "+action2);
        twilight_self.endTurn();

      });

      return 0;
    }





    ////////////////
    // China Card //
    ////////////////
    if (card == "china") {
      salert("China played as event");
      if (player == "ussr") {
        this.game.state.events.china_card = 2;
        this.game.state.events.china_card_facedown = 1;
        this.displayChinaCard();
      } else {
        this.game.state.events.formosan = 0; //Only cancel Formosan if US plays China Card
        this.game.state.events.china_card = 1;
        this.game.state.events.china_card_facedown = 1;
        this.displayChinaCard();
      }
      return 1;
    }




    /////////////////
    // CIA Created //
    /////////////////
    if (card == "cia") {

      //USSR needs to share its card information
      if (this.game.player == 1) {

        this.addMove("resolve\tcia");
        this.addMove("ops\tus\tcia\t1");
        this.addMove("setvar\tgame\tstate\tback_button_cancelled\t1");
        
        let revealed = "", keys = "";
        for (let i = 0; i < this.game.deck[0].hand.length; i++) {
          if (i > 0) { 
            revealed += ", "; 
            keys += " ";
          }
          revealed += this.game.deck[0].cards[this.game.deck[0].hand[i]].name;
          keys += this.game.deck[0].hand[i];
        }

        if (this.game.deck[0].hand.length > 0 ) {
          this.addMove("showhand\t1\t"+keys);
          this.addMove("notify\tUSSR holds: "+revealed);
        } else {
          this.addMove("notify\tUSSR has no cards to reveal");
        }

        this.endTurn();
      }

      this.updateStatus(`<div class='status-message' id='status-message'>US saw your hand and is playing 1OP (${this.cardToText(card)})</div>`);

      return 0;
    }




    if (card == "colonial") {

      if (this.game.player == 1) {
        return 0;
      }
      if (this.game.player == 2) {

        var twilight_self = this;
      
        var ops_to_place = 4;
        twilight_self.addMove("resolve\tcolonial");

        this.updateStatus(`<div class='status-message' id='status-message'>Place ${ops_to_place} influence in Africa or Southeast Asia (1 per country)</div>`);

        for (var i in this.countries) {
          if (this.countries[i].region == "africa" || this.countries[i].region == "seasia"){
            this.countries[i].place = 1;
            $("#"+i).addClass("westerneurope");
          }
        }

        $(".westerneurope").off();
        $(".westerneurope").on('click', function (e) {
            
          let countryname = $(this).attr('id');
          if (twilight_self.countries[countryname].place == 1) {
            twilight_self.addMove("place\tus\tus\t"+countryname+"\t1");
            twilight_self.placeInfluence(countryname, 1, "us");
            
            twilight_self.countries[countryname].place = 0;
            ops_to_place--;
            if (ops_to_place <= 0) {
              twilight_self.playerFinishedPlacingInfluence();
              twilight_self.endTurn();
              return 0;
            }
            twilight_self.updateStatus(`<div class='status-message' id='status-message'>Place ${ops_to_place} influence in Africa or Southeast Asia (1 per country)</div>`);
          } else {
            twilight_self.displayModal("you already placed there...");
          }
        });

        return 0;
      }
    }



    /////////////
    // Comecon //
    /////////////
    if (card == "comecon") {

      if (this.game.player == 2) { return 0; }
      if (this.game.player == 1) {

        var twilight_self = this;
        twilight_self.playerFinishedPlacingInfluence();

        var countries_where_i_can_place = 0;
        for (var i in this.countries) {
          if (i == "finland" || i == "poland" || i == "eastgermany" || i == "austria" || i == "czechoslovakia" || i == "bulgaria" || i == "hungary" || i == "romania" || i == "yugoslavia") {
            if (this.isControlled("us", i) != 1) {
              countries_where_i_can_place++;
              $(`#${i}`).addClass("easterneurope");
              twilight_self.countries[i].place = 1; //Allow placement
            }
          }
        }

        var ops_to_place = Math.min(4, countries_where_i_can_place);

        twilight_self.updateStatus("<div class='status-message' id='status-message'>Place "+ops_to_place+" influence in non-US controlled countries in Eastern Europe (1 per country)</div>");

        twilight_self.addMove("resolve\tcomecon");

        $(".easterneurope").on('click', function() {
          let c = $(this).attr('id');
          $(this).removeClass("easterneurope");
          if (twilight_self.countries[c].place == 1) { //only one per country
            twilight_self.addMove("place\tussr\tussr\t"+c+"\t1");
            twilight_self.placeInfluence(c, 1, "ussr"); 
            twilight_self.countries[c].place = 0;
            ops_to_place--;
            twilight_self.updateStatus("<div class='status-message' id='status-message'>Place "+ops_to_place+" influence in non-US controlled countries in Eastern Europe (1 per country)</div>");
            if (ops_to_place == 0) {
              twilight_self.playerFinishedPlacingInfluence();
              twilight_self.endTurn();
            }
          } else {
            twilight_self.displayModal("you already place one there...");
          }
        });


        return 0;
      }
    }




    /////////////////
    // Containment //
    /////////////////
    if (card == "containment") {
      this.game.state.events.containment = 1;
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }



    //
    // Cuban Missile Crisis
    //
    if (card == "cubanmissile") {

      if (this.game.state.events.norad == 1 && this.game.state.defcon != 2 && this.game.state.headline != 1) {
        this.game.state.us_defcon_bonus = 1;
      }

      this.game.state.defcon = 2;
      this.updateDefcon();
      if (player == "ussr") { this.game.state.events.cubanmissilecrisis = 2; }
      if (player == "us") { this.game.state.events.cubanmissilecrisis = 1; }

      
      if (!i_played_the_card){
        this.game.queue.push(`ACKNOWLEDGE\t${player.toUpperCase()} plays ${this.cardToText(card)}.`);
      }
      return 1;
    }






    //
    // Cultural Revolution
    //
    if (card == "culturalrev") {

      if (this.game.state.events.china_card == 1) {

        this.game.state.vp -= 1;
        this.updateLog("USSR gains 1 VP from Cultural Revolution");
        this.updateVictoryPoints();

      } else {

        if (this.game.state.events.china_card == 2) {

          this.updateLog("USSR gains the China Card face up");

          if (this.game.player == 1) {
            this.game.deck[0].hand.push("china");
          }
          this.game.state.events.china_card = 0;
          this.displayChinaCard();

        } else {

          //
          // it is in one of our hands
          //
          if (this.game.player == 1) {

            let do_i_have_cc = 0;

            for (let i = 0; i < this.game.deck[0].hand.length; i++) {
                  if (this.game.deck[0].hand[i] == "china") {
                do_i_have_cc = 1;
              }
            }

            if (do_i_have_cc == 1) {
              this.game.state.vp -= 1;
              this.updateVictoryPoints();
            } else {
              if (! this.game.deck[0].hand.includes("china")) {
                this.game.deck[0].hand.push("china");
              }
              this.game.state.events.china_card = 0;
              this.displayChinaCard();
            }

          }
          if (this.game.player == 2) {

            let do_i_have_cc = 0;

            for (let i = 0; i < this.game.deck[0].hand.length; i++) {
              if (this.game.deck[0].hand[i] == "china") {
                do_i_have_cc = 1;
              }
            }

            if (do_i_have_cc == 1) {
              for (let i = 0; i < this.game.deck[0].hand.length; i++) {
                if (this.game.deck[0].hand[i] == "china") {
                  this.game.deck[0].hand.splice(i, 1);
                  this.displayChinaCard();
                  return 1;
                }
              }
            } else {
              this.game.state.vp -= 1;
              this.updateLog("USSR gains 1 VP from Cultural Revolution");
              this.updateVictoryPoints();
            }
          }
        }
      }
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR plays ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS triggers ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }





    //
    // Latin American Death Squads
    //
    if (card == "deathsquads") {
      if (player == "ussr") { this.game.state.events.deathsquads--; }
      if (player == "us") { this.game.state.events.deathsquads++; }
      
      if (!i_played_the_card){
        this.game.queue.push(`ACKNOWLEDGE\t${player.toUpperCase()} plays ${this.cardToText(card)}.`);
      }
      return 1;
    }



    if (card == "debtcrisis") {

      if (this.game.player == 1) {
        //this.updateStatus("<div class='status-message' id='status-message'>US playing Latin American Debt Crisis</div>");
        return 0;
      }

      
      let twilight_self = this;
      let player = "ussr";
      if (this.game.player == 2) { player = "us"; }

      let user_message = "Choose a card to discard or USSR doubles influence in two countries in South America:";
      
      let cards_to_discard = [];

      for (let i = 0; i < this.game.deck[0].hand.length; i++) {
        if (this.game.deck[0].hand[i] != "china") {
          let avops = this.modifyOps(this.game.deck[0].cards[this.game.deck[0].hand[i]].ops, this.game.deck[0].hand[i], player, 0);
          if (avops >= 3) { 
            cards_to_discard.push(this.game.deck[0].hand[i]);
          }
        }
      }

      cards_to_discard.push("no discard");
      
      this.updateStatusAndListCards(user_message, cards_to_discard, false);

      if (cards_to_discard.length <= 1) {
        this.addMove("resolve\tdebtcrisis");
        this.addMove("latinamericandebtcrisis");
        this.addMove("notify\tUS has no cards available for Latin American Debt Crisis");
        this.endTurn();
        return 0;
      }

      twilight_self.attachCardboxEvents(function(action2) {
        if (action2 == "nodiscard") {
          twilight_self.addMove("resolve\tdebtcrisis");
          twilight_self.addMove("latinamericandebtcrisis");
          twilight_self.endTurn();
          return 0;
        }

        twilight_self.addMove("resolve\tdebtcrisis");
        twilight_self.addMove("discard\tus\t"+action2);
        twilight_self.addMove("NOTIFY\tUS discards "+twilight_self.cardToText(action2) + " to resolve "+ twilight_self.cardToText(card));
        twilight_self.removeCardFromHand(action2);
        twilight_self.endTurn();

      });

      return 0;
    }



    ////////////////////
    // Decolonization //
    ////////////////////
    if (card == "decolonization") {

      if (this.game.player == 2) {
        return 0;
      }
      if (this.game.player == 1) {

        var twilight_self = this;
        twilight_self.playerFinishedPlacingInfluence();

        var ops_to_place = 4;
        twilight_self.addMove("resolve\tdecolonization");

        this.updateStatus(`<div class='status-message' id='status-message'>Place ${ops_to_place} influence in Africa or Southeast Asia (1 per country)</div>`);

        for (var i in this.countries) {
          if (this.countries[i].region == "africa" || this.countries[i].region == "seasia"){
            this.countries[i].place = 1;
            $("#"+i).addClass("easterneurope");
          }
        }

        $(".easterneurope").off();
        $(".easterneurope").on('click', function (e) {
            
          let countryname = $(this).attr('id');
          if (twilight_self.countries[countryname].place == 1) {
            twilight_self.addMove("place\tussr\tussr\t"+countryname+"\t1");
            twilight_self.placeInfluence(countryname, 1, "ussr");
            
            twilight_self.countries[countryname].place = 0;
            ops_to_place--;
            if (ops_to_place <= 0) {
              twilight_self.playerFinishedPlacingInfluence();
              twilight_self.endTurn();
              return 0;
            }
            twilight_self.updateStatus(`<div class='status-message' id='status-message'>Place ${ops_to_place} influence in Africa or Southeast Asia (1 per country)</div>`);
          } else {
            twilight_self.displayModal("you already placed there...");
          }
        });

        return 0;
      }
    }




  if (card == "defectors") {

      if (this.game.state.headline == 0) {
        if (this.game.state.turn == 0) {
          this.game.state.vp += 1;
          this.updateLog("US gains 1 VP from Defectors");
          this.updateVictoryPoints();
        }
        return 1;
      }

      //
      // Defectors can be PULLED in the headline phase by 5 Year Plan or Grain Sales, in which
      // case it can only cancel the USSR headline if the USSR headline has not already gone.
      // what an insanely great but complicated game dynamic at play here....
      //
      if (this.game.state.headline == 1) {
        this.game.state.defectors_pulled_in_headline = 1;
      }

      return 1;
    }



    ///////////////////////////
    // DeGaulle Leads France //
    ///////////////////////////
    if (card == "degaulle") {
      this.game.state.events.degaulle = 1;
      this.game.state.events.nato_france = 0;
      this.removeInfluence("france", 2, "us");
      this.placeInfluence("france", 1, "ussr");
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR plays ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS triggers ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }



    /////////////////////
    // Destalinization //
    /////////////////////
    if (card == "destalinization") {

      if (this.game.player == 2) {
        //this.updateStatus("<div class='status-message' id='status-message'>USSR is playing Destalinization</div>");
        return 0;

      }
      if (this.game.player == 1) {

        var twilight_self = this;
        twilight_self.playerFinishedPlacingInfluence();

        twilight_self.addMove("resolve\tdestalinization");

        twilight_self.updateStatus('<div class="status-message" id="status-message">Remove four USSR influence from existing countries:</div>');

        let ops_to_purge = 4;

        
        $(".country").off();
        $(".country").on('click', function() {

          let c = $(this).attr('id');

          if (twilight_self.countries[c].ussr <= 0) {
            twilight_self.displayModal("Invalid Option");
            return;
          } else {
            twilight_self.removeInfluence(c, 1, "ussr");
            twilight_self.addMove("remove\tussr\tussr\t"+c+"\t1");
            ops_to_purge--;
            
            if (ops_to_purge == 0) {

              twilight_self.updateStatus('<div class="status-message" id="status-message">Add four USSR influence to any non-US controlled countries</div>');
              twilight_self.playerFinishedPlacingInfluence();

              var ops_to_place = 4;
              var countries_placed = {};
              
              $(".country").off();
              $(".country").on('click', function() {

                let cn = $(this).attr('id');
                if (twilight_self.isControlled("us", cn) == 1) {
                  twilight_self.displayModal("Cannot re-allocate to US controlled countries");
                  return;
                }
                if (!countries_placed[cn]){
                  countries_placed[cn] = 0;
                }

                if (countries_placed[cn] == 2) {
                  twilight_self.displayModal("Cannot place more than 2 influence in any one country");
                  return;
                } else {
                  twilight_self.placeInfluence(cn, 1, "ussr");
                  twilight_self.addMove("place\tussr\tussr\t"+cn+"\t1");
                  ops_to_place--;
                  countries_placed[cn]++;
                  if (ops_to_place == 0) {
                    twilight_self.playerFinishedPlacingInfluence();
                    twilight_self.endTurn();
                  }
                }
                
              });
              
            }
          }
        });
      
      }
      return 0;
    }




    ////////////////////
    // Duck and Cover //
    ////////////////////
    if (card == "duckandcover") {

      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }

      this.lowerDefcon();
      
      let vpchange = 5-this.game.state.defcon;

      this.game.state.vp = this.game.state.vp+vpchange;
      this.updateLog("US gains "+vpchange+" VP from Duck and Cover");
      this.updateVictoryPoints();

      return 1;
    }





    //////////////////////////
    // East European Unrest //
    //////////////////////////
    if (card == "easteuropean") {

      if (this.game.player == 1) {
        //this.updateStatus("<div class='status-message' id='status-message'>US is playing East European Unrest</div>");
        return 0;
      }
      if (this.game.player == 2) {

        var twilight_self = this;

        var ops_to_purge = (this.game.state.round > 7)? 2: 1;
        var countries_to_purge = 3;
        var options_purge = [];

        twilight_self.addMove("resolve\teasteuropean");

        if (twilight_self.countries['czechoslovakia'].ussr > 0) { options_purge.push('czechoslovakia'); }
        if (twilight_self.countries['austria'].ussr > 0) { options_purge.push('austria'); }
        if (twilight_self.countries['hungary'].ussr > 0) { options_purge.push('hungary'); }
        if (twilight_self.countries['romania'].ussr > 0) { options_purge.push('romania'); }
        if (twilight_self.countries['yugoslavia'].ussr > 0) { options_purge.push('yugoslavia'); }
        if (twilight_self.countries['bulgaria'].ussr > 0) { options_purge.push('bulgaria'); }
        if (twilight_self.countries['eastgermany'].ussr > 0) { options_purge.push('eastgermany'); }
        if (twilight_self.countries['poland'].ussr > 0) { options_purge.push('poland'); }
        if (twilight_self.countries['finland'].ussr > 0) { options_purge.push('finland'); }

        if (options_purge.length <= countries_to_purge) {
          //Speed up the game and select for the player
          let msg = `${twilight_self.cardToText(card)}: Auto remove ${ops_to_purge} OPS from `
          for (let i = 0; i < options_purge.length; i++) {
            twilight_self.addMove("remove\tus\tussr\t"+options_purge[i]+"\t"+ops_to_purge);
            twilight_self.removeInfluence(options_purge[i], ops_to_purge, "ussr");
            msg += twilight_self.countries[options_purge[i]].name + ", ";
          }
          twilight_self.addMove("NOTIFY\t"+msg.slice(0, -2));
          twilight_self.endTurn();
        } else {

          twilight_self.updateStatus("<div class='status-message' id='status-message'>Remove "+ops_to_purge+" from 3 countries in Eastern Europe</div>");
          
          for (let c of options_purge) {
            $("#"+c).addClass("westerneurope");
            this.countries[c].place = 1;
          }

          $(".westerneurope").off();
          $(".westerneurope").on('click', function() {

            let c = $(this).attr('id');

            if (twilight_self.countries[c].place != 1) {
              twilight_self.displayModal("Invalid Option");
            } else {
              twilight_self.countries[c].place = 0; //Only remove once
              let o = Math.min(ops_to_purge, twilight_self.countries[c].ussr);
              twilight_self.removeInfluence(c, o, "ussr");
              twilight_self.addMove("remove\tus\tussr\t"+c+"\t"+o);
              
              countries_to_purge--;
              if (countries_to_purge == 0) {
                twilight_self.playerFinishedPlacingInfluence();
                twilight_self.endTurn();
                return 0;
              }
            }
          });
        }
        return 0;
      }
    }




    if (card == "europe") {
      let vp_adjustment = this.calculateScoring("europe");
      this.showScoreOverlay(card, vp_adjustment);
      let total_vp = vp_adjustment.us.vp - vp_adjustment.ussr.vp;
      this.game.state.vp += total_vp;
      this.updateLog("<span>Europe:</span> " + total_vp + " <span>VP</span>");
      this.updateVictoryPoints();

      // stats
      if (player == "us") { this.game.state.stats.us_scorings++; }
      if (player == "ussr") { this.game.state.stats.ussr_scorings++; }

      return 1;
    }


    //
    // An Evil Empire
    //
    if (card == "evilempire") {

      this.game.state.events.evilempire = 1;
      this.game.state.events.flowerpower = 0; //Cancel Flower Power

      this.game.state.vp += 1;
      this.updateVictoryPoints();

      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }
      return 1;

    }


    ///////////
    // Fidel //
    ///////////
    if (card == "fidel") {
      let usinf = parseInt(this.countries['cuba'].us);
      let ussrinf = parseInt(this.countries['cuba'].ussr);
      this.removeInfluence("cuba", usinf, "us");
      if (ussrinf < 3) {
        this.placeInfluence("cuba", (3-ussrinf), "ussr");
      }
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR plays ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS triggers ${this.cardToText(card)}.`);
        }
      }
      
      return 1;
    }



    ////////////////////
    // Five Year Plan //
    ////////////////////
    if (card == "fiveyearplan") {

      let twilight_self = this;

      //
      // US has to wait for Soviets to execute
      // burn 1 roll
      //
      if (this.game.player == 2) {
        let burnrand = this.rollDice();
        return 0;
      }

      //
      // Soviets self-report - TODO provide proof
      // of randomness
      //
      if (this.game.player == 1) {

        twilight_self.addMove("resolve\tfiveyearplan");

        let available_cards = [];
        for (let i = 0; i < twilight_self.game.deck[0].hand.length; i++) {
          let thiscard = twilight_self.game.deck[0].hand[i];
          if (thiscard != "china" && (!(this.game.state.headline == 1 && (thiscard == this.game.state.headline_opponent_card || thiscard == this.game.state.headline_card)))) {
            available_cards.push(thiscard);
          }
        }

        if (available_cards.length == 0) {
          // burn roll anyway as US will burn
          let burnrand = this.rollDice();
          twilight_self.displayModal("No cards left to discard");
          this.addMove("notify\tUSSR has no cards to discard");
          this.endTurn();
          return 0;
        } else {

          let twilight_self = this;

          twilight_self.rollDice(available_cards.length, function(roll) {

            roll = parseInt(roll)-1;

            let card = available_cards[roll];

            twilight_self.removeCardFromHand(card);
            if (twilight_self.game.deck[0].cards[card].player == "us") {
              //twilight_self.displayModal("You have rolled: " + card);
              twilight_self.addMove("event\tus\t"+card);
              twilight_self.addMove("modal\tFive Year Plan\tUSSR triggers "+twilight_self.cardToText(card));
              twilight_self.addMove("NOTIFY\tFive Year Plan triggers US event: "+twilight_self.cardToText(card));
              twilight_self.endTurn();
            } else {
              //twilight_self.displayModal("You have rolled: " + card);
              twilight_self.addMove("modal\tFive Year Plan\tUSSR discards "+twilight_self.cardToText(card));
              twilight_self.addMove("NOTIFY\tUSSR discarded "+twilight_self.cardToText(card));
              twilight_self.endTurn();
            }
          });

          return 0;
        }
        return 0;
      }
    }






    //
    // Flower Power
    //
    if (card == "flowerpower") {
      if (this.game.state.events.evilempire == 1) {
        this.updateLog("Flower Power prevented by Evil Empire");
        return 1;
      }
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR plays ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS triggers ${this.cardToText(card)}.`);
        }
      }
      this.game.state.events.flowerpower = 1;
      return 1;
    }






    //////////////
    // Formosan //
    //////////////
    if (card == "formosan") {
      this.game.state.events.formosan = 1;
      $('.formosan_resolution').show();
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }




    if (card == "glasnost") {

      let twilight_self = this;

      this.game.state.defcon += 1;
      if (this.game.state.defcon > 5) { this.game.state.defcon = 5; }
      this.game.state.vp -= 2;
      this.updateDefcon();
      this.updateVictoryPoints();

      this.updateLog("DEFCON increases by 1 point");
      this.updateLog("USSR gains 2 VP");

      if (this.game.state.events.reformer == 1) {
        this.game.queue.push("resolve\tglasnost");
        this.game.queue.push("unlimit\tcoups");
        this.game.queue.push("ops\tussr\tglasnost\t4");
        this.game.queue.push("limit\tcoups");
        this.game.queue.push("notify\tUSSR plays 4 OPS for influence or realignments");
      } else {
        if (!i_played_the_card){
          if (player == "ussr"){
            this.game.queue.push(`ACKNOWLEDGE\tUSSR plays ${this.cardToText(card)}.`);
          }else{
            this.game.queue.push(`ACKNOWLEDGE\tUS triggers ${this.cardToText(card)}.`);
          }
        }
        
      }

      return 1;
    }





    //
    // Grain Sales to Soviets
    //
    if (card == "grainsales") {

      let twilight_self = this;

      //
      // US has to wait for Soviets to execute
      // burn 1 roll
      //
      if (this.game.player == 2) {
        let burnrand = this.rollDice();
        return 0;
      }

      //
      // Soviets self-report - TODO provide proof
      // of randomness
      //
      if (this.game.player == 1) {
      
        this.addMove("resolve\tgrainsales");

        let available_cards = [];
        for (let i = 0; i < twilight_self.game.deck[0].hand.length; i++) {
          let thiscard = twilight_self.game.deck[0].hand[i];
          if (thiscard != "china" && (!(this.game.state.headline == 1 && (thiscard == this.game.state.headline_opponent_card || thiscard == this.game.state.headline_card)))) {
            available_cards.push(thiscard);
          }
        }

        if (available_cards.length == 0) {
          let burnrand = this.rollDice();
          this.addMove("ops\tus\tgrainsales\t2");
          this.addMove("setvar\tgame\tstate\tback_button_cancelled\t1");
          this.addMove(`NOTIFY\tUSSR has no cards to give for ${this.cardToText(card)}`);
          this.endTurn();
          return 0;
        } else {

          twilight_self.rollDice(available_cards.length, function(roll) {

            roll = parseInt(roll)-1;
            let newcard = available_cards[roll];

            twilight_self.removeCardFromHand(newcard);
            twilight_self.addMove("grainsales\tussr\t"+newcard);
            twilight_self.addMove("setvar\tgame\tstate\tback_button_cancelled\t1");
            twilight_self.addMove("notify\tUSSR shares "+twilight_self.cardToText(newcard));
            twilight_self.endTurn();
            twilight_self.updateStatus(`<div class='status-message' id='status-message'>Sending ${twilight_self.cardToText(newcard)} to US</div>`);
          });
        }
      }
      return 0;
    }




    if (card == "howilearned") {

      let twilight_self = this;

      if (player == "ussr") { this.game.state.milops_ussr = 5; }
      if (player == "us") { this.game.state.milops_us = 5; }

      let adjustDefcon = function(defcon_target){
        twilight_self.addMove("resolve\thowilearned");

        if (defcon_target > twilight_self.game.state.defcon) {
          let defcon_diff = defcon_target-twilight_self.game.state.defcon;
          for (let i = 0; i < defcon_diff; i++) {
            twilight_self.addMove("defcon\traise");
          }
        }

        if (defcon_target < twilight_self.game.state.defcon) {
          let defcon_diff = twilight_self.game.state.defcon - defcon_target;
          for (let i = 0; i < defcon_diff; i++) {
            twilight_self.addMove("defcon\tlower");
          }
        }
        twilight_self.endTurn();
      }

      if (i_played_the_card) {

      	//
      	// make DEFCON boxes clickable
      	//
        for (let i = 1; i <= 5; i ++){
          twilight_self.app.browser.addElementToDom(`<div id="${i}" class="set_defcon_box set_defcon_box_${i}"></div>`, "gameboard");  
          $('.set_defcon_box_'+i).css('top', twilight_self.scale(twilight_self.game.state.defcon_ps[5-i].top)+"px");
          $('.set_defcon_box_'+i).css('left', twilight_self.scale(twilight_self.game.state.defcon_ps[5-i].left)+"px");

        }
      	
        $('.set_defcon_box').css('width', twilight_self.scale(120)+"px");
        $('.set_defcon_box').css('height', twilight_self.scale(120)+"px");
        $('.set_defcon_box').css('z-index', 1000);
        $('.set_defcon_box').css('background-color', 'yellow');
        $('.set_defcon_box').css('opacity', 0.5);
        $('.set_defcon_box').css('display', 'block');
        $('.set_defcon_box').css('position', 'absolute');
        
        
      	$('.set_defcon_box').off();
      	$('.set_defcon_box').on('click', async function(e) {

      	  let defcon_target = parseInt(e.currentTarget.id);
      	  let confirm_it = await sconfirm("Set DEFCON at "+defcon_target+"?");
      	  if (!confirm_it) { return; }
          adjustDefcon(defcon_target);
      	  $('.set_defcon_box').remove();

    	  });



      	//
      	// and handle with the HUD too
      	//
        twilight_self.updateStatusWithOptions('Set DEFCON to:','<ul><li class="card" id="5">five</li><li class="card" id="4">four</li><li class="card" id="3">three</li><li class="card" id="2">two</li><li class="card" id="1">one</li></ul></div>',false);
        twilight_self.attachCardboxEvents(function(action2) {
          adjustDefcon(parseInt(action2));
      	  $('.set_defcon_box').remove();

        });
      }
      return 0;
    }




    ////////////////////////
    // Indo-Pakistani War //
    ////////////////////////
    if (card == "indopaki") {
      let target = 4;
      let me = "ussr";
      let opponent = "us";
      if (this.game.player == 2) { opponent = "ussr"; me = "us"; }

      if (me != player) {
        let burned = this.rollDice(6);
        return 0;
      }
      if (me == player) {

        var twilight_self = this;
        twilight_self.playerFinishedPlacingInfluence();

        twilight_self.addMove("resolve\tindopaki");
        twilight_self.updateStatusWithOptions('Indo-Pakistani War. Choose Target to invade:',`<ul><li class="card" id="pakistan">Pakistan</li><li class="card" id="india">India</li></ul>`,false);

        let modifications = 0;
        let winner = "india";

        twilight_self.attachCardboxEvents(function(invaded) {

          for (let c in twilight_self.countries[invaded].neighbours){
            if (twilight_self.isControlled(opponent, c) == 1) { modifications++; }
          }

          let die = twilight_self.rollDice(6);
          twilight_self.addMove("NOTIFY\t"+player.toUpperCase()+`rolls: ${die}, adjusted: ${die-modifications}`);

          if (die >= target + modifications) { //Successful Invasion
            winner = (invaded == "pakistan")? "India conquers Pakistan!": "Pakistan conquers India";

            let influence_change = 0;
            if (player == "us") {
              influence_change = twilight_self.countries[invaded].ussr;
            } else {
              influence_change = twilight_self.countries[invaded].us;
            }
            if (influence_change > 0){
              twilight_self.addMove(`place\t${player}\t${player}\t${invaded}\t${influence_change}`);
              twilight_self.addMove(`remove\t${player}\t${opponent}\t${invaded}\t${influence_change}`);
              twilight_self.placeInfluence(invaded, influence_change, player);
              twilight_self.removeInfluence(invaded, influence_change, opponent);
            }
            twilight_self.addMove(`milops\t${player}\t2`);
            twilight_self.addMove(`vp\t${player}\t2`);

          } else { //India fails invasion
            winner = (invaded == "pakistan")? "Pakistan repels Indians aggression!": "India repels Pakistani aggression!";
            if (player == "us") {
              twilight_self.addMove("milops\tus\t2");
            } else {
              twilight_self.addMove("milops\tussr\t2");
            }
          }
          twilight_self.addMove(`war\t${card}\t${winner}\t${die}\t${modifications}\t${player}`);
          twilight_self.endTurn();
            
        });
      }
      return 0;
    }




    if (card == "indreds") {

      if (this.game.player == 1) {
        //this.updateStatus("<div class='status-message' id='status-message'>US is playing Independent Reds</div>");
        return 0;
      }

      let yugo_ussr = this.countries['yugoslavia'].ussr;
      let romania_ussr = this.countries['romania'].ussr;
      let bulgaria_ussr = this.countries['bulgaria'].ussr;
      let hungary_ussr = this.countries['hungary'].ussr;
      let czechoslovakia_ussr = this.countries['czechoslovakia'].ussr;

      let yugo_us = this.countries['yugoslavia'].us;
      let romania_us = this.countries['romania'].us;
      let bulgaria_us = this.countries['bulgaria'].us;
      let hungary_us = this.countries['hungary'].us;
      let czechoslovakia_us = this.countries['czechoslovakia'].us;

      let yugo_diff = yugo_ussr - yugo_us;
      let romania_diff = romania_ussr - romania_us;
      let bulgaria_diff = bulgaria_ussr - bulgaria_us;
      let hungary_diff = hungary_ussr - hungary_us;
      let czechoslovakia_diff = czechoslovakia_ussr - czechoslovakia_us;


      this.addMove("resolve\tindreds");
      if (hungary_us >= hungary_ussr && yugo_us >= yugo_ussr && romania_us >= romania_ussr && bulgaria_us >= bulgaria_ussr && czechoslovakia_us >= czechoslovakia_ussr) {
        this.endTurn();
        return 0;
      } else {


        let userhtml = "<ul>";

        if (yugo_diff > 0) {
          userhtml += '<li class="card" id="yugoslavia">Yugoslavia</li>';
        }
        if (romania_diff > 0) {
          userhtml += '<li class="card" id="romania">Romania</li>';
        }
        if (bulgaria_diff > 0) {
          userhtml += '<li class="card" id="bulgaria">Bulgaria</li>';
        }
        if (hungary_diff > 0) {
          userhtml += '<li class="card" id="hungary">Hungary</li>';
        }
        if (czechoslovakia_diff > 0) {
          userhtml += '<li class="card" id="czechoslovakia">Czechoslovakia</li>';
        }
        userhtml += '</ul>';

        this.updateStatusWithOptions("Match USSR influence in which country?",userhtml,false);
        let twilight_self = this;

        twilight_self.attachCardboxEvents(function(myselect) {
          $('.card').off();

          if (myselect == "romania") {
            twilight_self.placeInfluence(myselect, romania_diff, "us");
            twilight_self.addMove("place\tus\tus\tromania\t"+romania_diff);
            twilight_self.endTurn();
          }
          if (myselect == "yugoslavia") {
            twilight_self.placeInfluence(myselect, yugo_diff, "us");
            twilight_self.addMove("place\tus\tus\tyugoslavia\t"+yugo_diff);
            twilight_self.endTurn();
          }
          if (myselect == "bulgaria") {
            twilight_self.placeInfluence(myselect, bulgaria_diff, "us");
            twilight_self.addMove("place\tus\tus\tbulgaria\t"+bulgaria_diff);
            twilight_self.endTurn();
          }
          if (myselect == "hungary") {
            twilight_self.placeInfluence(myselect, hungary_diff, "us");
            twilight_self.addMove("place\tus\tus\thungary\t"+hungary_diff);
            twilight_self.endTurn();
          }
          if (myselect == "czechoslovakia") {
            twilight_self.placeInfluence(myselect, czechoslovakia_diff, "us");
            twilight_self.addMove("place\tus\tus\tczechoslovakia\t"+czechoslovakia_diff);
            twilight_self.endTurn();
          }

          return 0;

        });

        return 0;
      }
      return 1;
    }








    //
    // Iran-Contra Scandal
    //
    if (card == "irancontra") {
      this.game.state.events.irancontra = 1;

      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR plays ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS triggers ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }



    //
    // Iranian Hostage Crisis
    //
    if (card == "iranianhostage") {
      this.game.state.events.iranianhostage = 1;
      if (this.countries["iran"].us > 0) { this.removeInfluence("iran", this.countries["iran"].us, "us"); }
      this.placeInfluence("iran", 2, "ussr");
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR plays ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS triggers ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }




    if (card == "iraniraq") {

      let me = "ussr";
      let opponent = "us";
      if (this.game.player == 2) { opponent = "ussr"; me = "us"; }

      if (me != player) {
        let burned = this.rollDice(6);
        return 0;
      }
      if (me == player) {

        var twilight_self = this;
        twilight_self.playerFinishedPlacingInfluence();

        twilight_self.addMove("resolve\tiraniraq");
        twilight_self.updateStatusWithOptions('Iran-Iraq War. Choose Target:',`<ul><li class="card" id="iraq">Iraq</li><li class="card" id="iran">Iran</li></ul>`,false);

        let target = 4;
        let modifications = 0;
        let winner = "";

        twilight_self.attachCardboxEvents(function(invaded) {

          for (let c in twilight_self.countries[invaded].neighbours){
            if (twilight_self.isControlled(opponent, c) == 1) { modifications++; }
          }

          let die = twilight_self.rollDice(6);
          twilight_self.addMove("NOTIFY\t"+player.toUpperCase()+`rolls: ${die}, adjusted: ${die-modifications}`);

          if (die >= target + modifications) { //Successful Invasion
            winner = (invaded == "iran")? "Iraq conquers Iran!": "Iran conquers Iraq";

            let influence_change = 0;
            if (player == "us") {
              influence_change = twilight_self.countries[invaded].ussr;
            } else {
              influence_change = twilight_self.countries[invaded].us;
            }
            if (influence_change > 0){
              twilight_self.addMove(`place\t${player}\t${player}\t${invaded}\t${influence_change}`);
              twilight_self.addMove(`remove\t${player}\t${opponent}\t${invaded}\t${influence_change}`);
              twilight_self.placeInfluence(invaded, influence_change, player);
              twilight_self.removeInfluence(invaded, influence_change, opponent);
            }
            twilight_self.addMove(`milops\t${player}\t2`);
            twilight_self.addMove(`vp\t${player}\t2`);
            twilight_self.showInfluence(invaded);

          } else { //India fails invasion
            winner = (invaded == "iran")? "Iran repels Iraqi aggression!": "Iraq repels Iranian aggression!";
            if (player == "us") {
              twilight_self.addMove("milops\tus\t2");
            } else {
              twilight_self.addMove("milops\tussr\t2");
            }
          }
          twilight_self.addMove(`war\t${card}\t${winner}\t${die}\t${modifications}\t${player}`);
          twilight_self.endTurn();


        });
      }
      return 0;
    }




    //
    // The Iron Lady
    //
    if (card == "ironlady") {

      this.game.state.vp += 1;
      this.updateVictoryPoints();

      //
      // keep track of whether the USSR has influence in Argentina in order
      // to know whether it can place there or beside Argentina if it plays
      // ops after the event, and uses the US event to get influence into the
      // country..
      //
      this.game.state.ironlady_before_ops = 1;

      this.placeInfluence("argentina", 1, "ussr");
      if (this.countries["uk"].ussr > 0) { this.removeInfluence("uk", this.countries["uk"].ussr, "ussr"); }

      this.game.state.events.ironlady = 1;

      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }





    //
    // John Paul II
    //
    if (card == "johnpaul") {

      this.game.state.events.johnpaul = 1;

      this.removeInfluence("poland", 2, "ussr");
      this.placeInfluence("poland", 1, "us");
       if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }



    //
    // Junta
    //
    if (card == "junta") {

      this.game.state.events.junta = 1;

      if (i_played_the_card) {
        let className = (player == "us")? "westerneurope" : "easterneurope";
        var twilight_self = this;
        twilight_self.playerFinishedPlacingInfluence();

        twilight_self.updateStatus('<div class="status-message" id="status-message">' + player.toUpperCase() + ' to place 2 Influence in Central or South America</div>');

        for (var i in this.countries) {
          if (this.countries[i].region === "samerica" || this.countries[i].region === "camerica") {
            $("#"+i).addClass(className);
          }
        }

        let divname = '.'+className;

        $(divname).off();
        $(divname).on('click', function() {

          let c = $(this).attr('id');
          twilight_self.placeInfluence(c, 2, player);
          twilight_self.playerFinishedPlacingInfluence();
              
          let confirmoptional = '<ul><li class="card" id="conduct">coup or realign</li><li class="card" id="skip">skip</li></ul>';
          twilight_self.updateStatusWithOptions("Do you wish to use 2 free OPS for a coup or realignment rolls in Central or South America?",confirmoptional,false);
          twilight_self.attachCardboxEvents(function(action2) {

            if (action2 == "conduct") {
              twilight_self.addMove("resolve\tjunta");
              twilight_self.addMove("unlimit\tplacement");
              twilight_self.addMove("unlimit\tmilops");
              twilight_self.addMove("unlimit\tregion");
              twilight_self.addMove("ops\t"+player+"\tjunta\t2");
              twilight_self.addMove("limit\tregion\teurope");
              twilight_self.addMove("limit\tregion\tafrica");
              twilight_self.addMove("limit\tregion\tmideast");
              twilight_self.addMove("limit\tregion\tasia");
              twilight_self.addMove("limit\tregion\tseasia");
              twilight_self.addMove("limit\tmilops");
              twilight_self.addMove("limit\tplacement");
              twilight_self.addMove("place\t"+player+"\t"+player+"\t"+c+"\t2");
              twilight_self.addMove("setvar\tgame\tstate\tback_button_cancelled\t1");
              twilight_self.playerFinishedPlacingInfluence();
              twilight_self.endTurn();
            }

            if (action2 == "skip") {
              twilight_self.addMove("resolve\tjunta");
              twilight_self.addMove("place\t"+player+"\t"+player+"\t"+c+"\t2");
              twilight_self.playerFinishedPlacingInfluence();
              twilight_self.endTurn();
            }

          });
        
      });
      }
      return 0;
    }



    if (card == "KAL007") {

      this.game.state.vp += 2;
      this.updateVictoryPoints();

      this.lowerDefcon();

      if (this.isControlled("us", "southkorea") == 1) {
        this.game.queue.push("resolve\tKAL007");
        this.game.queue.push("unlimit\tcoups");
        this.game.queue.push("ops\tus\tKAL007\t4");
        this.game.queue.push("setvar\tgame\tstate\tback_button_cancelled\t1");
        this.game.queue.push("limit\tcoups"); 
      } 
      
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }
      return 1;
      

    }



    //
    // Kitchen Debates
    //
    if (card == "kitchendebates") {

      let us_bg = 0;
      let ussr_bg = 0;

      if (this.isControlled("us", "mexico") == 1)        { us_bg++; }
      if (this.isControlled("ussr", "mexico") == 1)      { ussr_bg++; }
      if (this.isControlled("us", "cuba") == 1)          { us_bg++; }
      if (this.isControlled("ussr", "cuba") == 1)        { ussr_bg++; }
      if (this.isControlled("us", "panama") == 1)        { us_bg++; }
      if (this.isControlled("ussr", "panama") == 1)      { ussr_bg++; }

      if (this.isControlled("us", "venezuela") == 1)     { us_bg++; }
      if (this.isControlled("ussr", "venezuela") == 1)   { ussr_bg++; }
      if (this.isControlled("us", "brazil") == 1)        { us_bg++; }
      if (this.isControlled("ussr", "brazil") == 1)      { ussr_bg++; }
      if (this.isControlled("us", "argentina") == 1)     { us_bg++; }
      if (this.isControlled("ussr", "argentina") == 1)   { ussr_bg++; }
      if (this.isControlled("us", "chile") == 1)         { us_bg++; }
      if (this.isControlled("ussr", "chile") == 1)       { ussr_bg++; }

      if (this.isControlled("us", "southafrica") == 1)   { us_bg++; }
      if (this.isControlled("ussr", "southafrica") == 1) { ussr_bg++; }
      if (this.isControlled("us", "angola") == 1)        { us_bg++; }
      if (this.isControlled("ussr", "angola") == 1)      { ussr_bg++; }
      if (this.isControlled("us", "zaire") == 1)         { us_bg++; }
      if (this.isControlled("ussr", "zaire") == 1)       { ussr_bg++; }
      if (this.isControlled("us", "nigeria") == 1)       { us_bg++; }
      if (this.isControlled("ussr", "nigeria") == 1)     { ussr_bg++; }
      if (this.isControlled("us", "algeria") == 1)       { us_bg++; }
      if (this.isControlled("ussr", "algeria") == 1)     { ussr_bg++; }

      if (this.isControlled("us", "poland") == 1)        { us_bg++; }
      if (this.isControlled("ussr", "poland") == 1)      { ussr_bg++; }
      if (this.isControlled("us", "eastgermany") == 1)   { us_bg++; }
      if (this.isControlled("ussr", "eastgermany") == 1) { ussr_bg++; }
      if (this.isControlled("us", "westgermany") == 1)   { us_bg++; }
      if (this.isControlled("ussr", "westgermany") == 1) { ussr_bg++; }
      if (this.isControlled("us", "france") == 1)        { us_bg++; }
      if (this.isControlled("ussr", "france") == 1)      { ussr_bg++; }
      if (this.isControlled("us", "italy") == 1)         { us_bg++; }
      if (this.isControlled("ussr", "italy") == 1)       { ussr_bg++; }

      if (this.isControlled("us", "libya") == 1)         { us_bg++; }
      if (this.isControlled("ussr", "libya") == 1)       { ussr_bg++; }
      if (this.isControlled("us", "egypt") == 1)         { us_bg++; }
      if (this.isControlled("ussr", "egypt") == 1)       { ussr_bg++; }
      if (this.isControlled("us", "israel") == 1)        { us_bg++; }
      if (this.isControlled("ussr", "israel") == 1)      { ussr_bg++; }
      if (this.isControlled("us", "iraq") == 1)          { us_bg++; }
      if (this.isControlled("ussr", "iraq") == 1)        { ussr_bg++; }
      if (this.isControlled("us", "iran") == 1)          { us_bg++; }
      if (this.isControlled("ussr", "iran") == 1)        { ussr_bg++; }
      if (this.isControlled("us", "saudiarabia") == 1)   { us_bg++; }
      if (this.isControlled("ussr", "saudiarabia") == 1) { ussr_bg++; }

      if (this.isControlled("us", "pakistan") == 1)      { us_bg++; }
      if (this.isControlled("ussr", "pakistan") == 1)    { ussr_bg++; }
      if (this.isControlled("us", "india") == 1)         { us_bg++; }
      if (this.isControlled("ussr", "india") == 1)       { ussr_bg++; }
      if (this.isControlled("us", "thailand") == 1)      { us_bg++; }
      if (this.isControlled("ussr", "thailand") == 1)    { ussr_bg++; }
      if (this.isControlled("us", "japan") == 1)         { us_bg++; }
      if (this.isControlled("ussr", "japan") == 1)       { ussr_bg++; }
      if (this.isControlled("us", "southkorea") == 1)    { us_bg++; }
      if (this.isControlled("ussr", "southkorea") == 1)  { ussr_bg++; }
      if (this.isControlled("us", "northkorea") == 1)    { us_bg++; }
      if (this.isControlled("ussr", "northkorea") == 1)  { ussr_bg++; }

      if (us_bg > ussr_bg) {
        this.game.state.events.kitchendebates = 1;
        this.updateLog("US controls "+us_bg + " battlegrounds and USSR controls "+ ussr_bg +" battlegrounds");
        this.updateLog("US gains 2 VP and pokes USSR in chest...");
        this.game.state.vp += 2;
        this.updateVictoryPoints();
      } else {
        this.updateLog("US controls "+us_bg + " battlegrounds and USSR controls "+ ussr_bg +" battlegrounds");
        this.updateLog("US does not have more battleground countries than USSR...");
      }
       if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }

      return 1;
    }





    ////////////////
    // Korean War //
    ////////////////
    if (card == "koreanwar") {

      let target = 4;
      
      let modifications = 0;
      if (this.isControlled("us", "japan") == 1) { modifications++; }
      if (this.isControlled("us", "taiwan") == 1) { modifications++; }
      if (this.isControlled("us", "northkorea") == 1) { modifications++; }

      let roll = this.rollDice(6);
      
      this.updateLog(`${player.toUpperCase()} rolls: ${roll}, adjusted: ${roll-modifications}`);
      //this.updateLog("<span>" + player.toUpperCase()+"</span> <span>modified:</span> "+(roll-modified));

      let winner = "";

      if (roll - modifications >= target) {
        winner = "North Korea wins!";
        this.updateLog("North Korea wins the Korean War");
        if (this.countries['southkorea'].us > 0){
          this.placeInfluence("southkorea", this.countries['southkorea'].us, "ussr");
          this.removeInfluence("southkorea", this.countries['southkorea'].us, "us");  
        }
        this.game.state.vp -= 2;
        this.updateVictoryPoints();
      } else {
        winner = "South Korea wins!";
        this.updateLog("South Korea wins the Korean War");
      }

      this.game.state.milops_ussr += 2;
      this.updateMilitaryOperations();
      this.showWarOverlay(card, winner, roll, modifications);
      return 1;

    }



    if (card == "liberation") {

      if (this.game.player == 2) {
        return 0;
      }
      if (this.game.player == 1) {

        var twilight_self = this;
        twilight_self.playerFinishedPlacingInfluence();

        var ops_to_place = 3;
        var already_placed = {};

        twilight_self.addMove("resolve\tliberation");

        this.updateStatus("<div class='status-message' id='status-message'>USSR places three influence in Central America (max 2 per country)</div>");
        for (var i in this.countries) {
          if (this.countries[i].region == "camerica"){
            this.countries[i].place = 1;
            
            $("#"+i).addClass("easterneurope");
          }
        }

        $(".easterneurope").off();
        $(".easterneurope").on('click', function() {
          let countryname = $(this).attr('id');
          if (twilight_self.countries[countryname].place == 1) {
            if (already_placed[countryname]) {
              twilight_self.countries[countryname].place = 0;
            }else{
              already_placed[countryname] = 1;  
            }
            twilight_self.addMove("place\tussr\tussr\t"+countryname+"\t1");
            twilight_self.placeInfluence(countryname, 1, "ussr");
            
            ops_to_place--;
            if (ops_to_place == 0) {
              twilight_self.playerFinishedPlacingInfluence();
              twilight_self.endTurn();
            }
          } else {
            twilight_self.displayModal("you cannot place there...");
          }
        });
          
        return 0;
      }
    }





    //
    // Lone Gunman
    //
    if (card == "lonegunman") {

      if (this.game.player == 1) {
        //this.updateStatus("<div class='status-message' id='status-message'>US is playing Lone Gunman</div>");
        return 0;

      }
      if (this.game.player == 2) {

        this.addMove("resolve\tlonegunman");
        this.addMove("ops\tussr\tlonegunman\t1");
        this.addMove("setvar\tgame\tstate\tback_button_cancelled\t1");
  
       let revealed = "", keys = "";
        for (let i = 0; i < this.game.deck[0].hand.length; i++) {
          if (i > 0) { 
            revealed += ", "; 
            keys += " ";
          }
          revealed += this.game.deck[0].cards[this.game.deck[0].hand[i]].name;
          keys += this.game.deck[0].hand[i];
        }

        this.addMove("showhand\t2\t"+keys);

        if (this.game.deck[0].hand.length > 0 ) {
          this.addMove("NOTIFY\tUS holds: "+revealed);
        } else {
          this.addMove("NOTIFY\tUS has no cards to reveal");
        }

        this.endTurn();
      }
      return 0;
    }



    if (card == "marine") {

      if (this.countries["lebanon"].us > 0){
        this.countries["lebanon"].us = 0;
        this.showInfluence("lebanon", "us");
        this.updateLog(`${this.cardToText(card)}: All US influence removed from Lebanon`);  
      }else{
        this.updateLog(`${this.cardToText(card)}: No US influence in Lebanon to remove`);  
      }
       

      let ustroops = 0;
      for (var i in this.countries) {
        if (this.countries[i].region == "mideast") {
          ustroops += this.countries[i].us;

        }
      }

      if (ustroops == 0) {
        this.updateLog("US has no influence in the Middle-East");
        return 1;
      }

      if (this.game.player == 2) {
        return 0;
      }
      if (this.game.player == 1) {

        this.addMove("resolve\tmarine");

        var twilight_self = this;
        twilight_self.playerFinishedPlacingInfluence();

        var ops_available = 0;
        for (var i in this.countries) {
          if (this.countries[i].region == "mideast") {
            if (this.countries[i].us > 0) {
              ops_available += this.countries[i].us;
              $("#"+i).addClass("easterneurope");
              this.countries[i].place = 1;
            }
          }
        }

        let ops_to_purge = Math.min(2, ops_available);

        this.updateStatus("<div class='status-message' id='status-message'>Remove</span> <span>"+ops_to_purge+" </span>US influence from the Middle East</div>");
        
        $(".easterneurope").off();
        $(".easterneurope").on('click', function() {

          let c = $(this).attr('id');

          if (twilight_self.countries[c].place != 1 || twilight_self.countries[c].us == 0) {
            twilight_self.displayModal("Invalid Country");
          } else {
            twilight_self.removeInfluence(c, 1, "us");
            twilight_self.addMove("remove\tussr\tus\t"+c+"\t1");
            ops_to_purge--;
            if (ops_to_purge == 0) {
              twilight_self.playerFinishedPlacingInfluence();
              twilight_self.endTurn();
            }
          }
          twilight_self.updateStatus("<div class='status-message' id='status-message'>Remove</span> <span>"+ops_to_purge+" </span>US influence from the Middle East</div>");
        
        });

        
        return 0;
      }
    }






    if (card == "marshall") {

      this.game.state.events.marshall = 1;
      var twilight_self = this;

      if (this.game.player == 1) {
        //this.updateStatus("<div class='status-message' id='status-message'>US is playing Marshall Plan</div>");
        return 0;

      }
      if (this.game.player == 2) {

        var countries_where_i_can_place = 0;
        for (var i in this.countries) {
          if (i == "canada" || i == "uk" || i == "sweden" || i == "france" || i == "benelux" || i == "westgermany" || i == "spain" ||  i == "italy" || i == "greece" || i == "turkey" || i == "denmark" || i == "norway" || i == "sweden" ||  i == "finland" || i == "austria") {
            if (this.isControlled("ussr", i) != 1) {
              countries_where_i_can_place++;
              $(`#${i}`).addClass("westerneurope");
              twilight_self.countries[i].place = 1; //Allow placement
            }
          }
        }

        var ops_to_place = Math.min(7, countries_where_i_can_place);
        
        this.updateStatus("<div class='status-message' id='status-message'>Place 1 influence in each of "+ops_to_place+" non USSR-controlled countries in Western Europe</div>");

        twilight_self.addMove("resolve\tmarshall");
        
        $(".westerneurope").on('click', function() {
          let c = $(this).attr('id');
          $(this).removeClass("westerneurope");
          
          if (twilight_self.countries[c].place == 1) { //only one per country
            twilight_self.addMove("place\tus\tus\t"+c+"\t1");
            twilight_self.placeInfluence(c, 1, "us"); 
            twilight_self.countries[c].place = 0;
            ops_to_place--;
            twilight_self.updateStatus("<div class='status-message' id='status-message'>Place 1 influence in each of "+ops_to_place+" non USSR-controlled countries in Western Europe</div>");
            if (ops_to_place <= 0) {
              twilight_self.playerFinishedPlacingInfluence();
              twilight_self.endTurn();
            }
          } else {
            twilight_self.displayModal("you already place one there...");
          }
        });

        return 0;
      }
    }


    if (card == "mideast") {
      let vp_adjustment = this.calculateScoring("mideast");
      this.showScoreOverlay(card, vp_adjustment);
      let total_vp = vp_adjustment.us.vp - vp_adjustment.ussr.vp;
      this.game.state.vp += total_vp;
      this.updateLog("<span>Middle East:</span> " + total_vp + " <span>VP</span>");

      // stats
      if (player == "us") { this.game.state.stats.us_scorings++; }
      if (player == "ussr") { this.game.state.stats.ussr_scorings++; }



      this.updateVictoryPoints();
      return 1;
    }


    //
    // Missile Envy
    //
    if (card == "missileenvy") {

      let twilight_self = this;

      let instigator = 1;
      let opponent = "us";
      if (player == "us") { instigator = 2; opponent = "ussr"; }
      this.game.state.events.missileenvy = 1;

      //
      //
      //
      if (this.game.player == instigator) {
        this.updateStatus("<div class='status-message' id='status-message'>Opponent is returning card for Missile Envy</div>");
        return 0;

      }


      //
      // targeted player provided list if multiple options available
      //
      if (this.game.player != instigator && this.game.player != 0) {

        this.addMove("resolve\tmissileenvy");

        let selected_card  = "";
        let selected_ops   = -1;
        let multiple_cards = 0;
        let available_cards = [];

        if (this.game.deck[0].hand.length == 0) {
          this.addMove("notify\t"+opponent.toUpperCase()+" hand contains no cards.");
          this.endTurn();
          return 0;
        }

        for (let i = 0; i < twilight_self.game.deck[0].hand.length; i++) {
          let thiscard = twilight_self.game.deck[0].hand[i];
          if (thiscard != "china" && (!(this.game.state.headline == 1 && (thiscard == this.game.state.headline_opponent_card || thiscard == this.game.state.headline_card)))) {
            available_cards.push(thiscard);
          }
        }

        if (available_cards.length == 0) {
          this.addMove("notify\t"+opponent.toUpperCase()+" hand has no eligible cards.");
          this.endTurn();
          return 0;
        }

        for (let i = 0; i < available_cards.length; i++) {

          let card = this.game.deck[0].cards[available_cards[i]];

          if (this.modifyOps(card.ops) == selected_ops) {
            multiple_cards = 1;
          }

          if (this.modifyOps(card.ops) > selected_ops) {
            selected_ops  = this.modifyOps(card.ops);
            selected_card = available_cards[i];
            multiple_cards = 0;
          }
        }


        if (multiple_cards == 0) {

          //
          // offer highest card
          //
          this.addMove("missileenvy\t"+this.game.player+"\t"+selected_card);
          this.endTurn();

        } else {

          //
          // select highest card
          //
          let html = "<ul>";
          for (let i = 0; i < available_cards.length; i++) {
            if (this.modifyOps(this.game.deck[0].cards[available_cards[i]].ops) == selected_ops && available_cards[i] != "china") {
              html += `<li class="card" id="${available_cards[i]}">${this.game.deck[0].cards[available_cards[i]].name}</li>`;
            }
          }
          html += '</ul>';
          this.updateStatusWithOptions("Select card to give opponent:",html,false);
          twilight_self.attachCardboxEvents(function(action2) {

            //
            // offer card
            //
            twilight_self.addMove("missileenvy\t"+twilight_self.game.player+"\t"+action2);
            twilight_self.endTurn();

          });
        }
      }
      return 0;
    }




    if (card == "muslimrevolution") {

      if (this.game.state.events.awacs == 1) { return 1; }

      var countries_to_purge = 2;
      let muslim_countries = [];

      for (var i in this.countries) {
        if (i == "sudan" || i == "egypt" || i == "libya" || i == "syria" || i == "iran" || i == "iraq" || i == "jordan" || i == "saudiarabia") {
          if (this.countries[i].us > 0) {
            muslim_countries.push(i);
          }
        }
      }

      if (muslim_countries.length == 0) {
        this.updateLog("Muslim Revolutions targets no countries with US influence.");
        return 1;
      }

      if (muslim_countries.length <= 2) {
        for (var i of muslim_countries) {
          this.updateLog("Muslim Revolutions removes all US influence in "+i);
          this.removeInfluence(i, this.countries[i].us, "us");
        }
      
        if (!i_played_the_card){
          if (player == "ussr"){
            this.game.queue.push(`ACKNOWLEDGE\tUSSR plays ${this.cardToText(card)}.`);
          }else{
            this.game.queue.push(`ACKNOWLEDGE\tUS triggers ${this.cardToText(card)}.`);
          }
        }

        return 1;
      }

      //
      // or ask the USSR to choose
      //
      if (this.game.player == 2) { return 0; }
      if (this.game.player == 1) {

        this.updateStatus("<div class='status-message' id='status-message'>Remove All US influence from 2 countries among: Sudan, Egypt, Iran, Iraq, Libya, Saudi Arabia, Syria, Jordan.</div>");

        var twilight_self = this;
        twilight_self.playerFinishedPlacingInfluence();
        twilight_self.addMove("resolve\tmuslimrevolution");

        for (var i of muslim_countries) {
          $("#"+i).addClass("easterneurope");
        }
          $(".easterneurope").off();
          $(".easterneurope").on('click', function() {

            let c = $(this).attr('id');

            if (twilight_self.countries[c].us <= 0) {
              twilight_self.displayModal("Invalid Country");
            } else {
              let purginf = twilight_self.countries[c].us;
              twilight_self.removeInfluence(c, purginf, "us");
              
              twilight_self.addMove("remove\tussr\tus\t"+c+"\t"+purginf);
              countries_to_purge--;
              if (countries_to_purge == 0) {
                twilight_self.playerFinishedPlacingInfluence();
                twilight_self.endTurn();
              }
            }
          });        
      }
      return 0;
    }





    //
    // NASSER
    //
    if (card == "nasser") {

      let original_us = parseInt(this.countries["egypt"].us);
      let influence_to_remove = 0;

      while (original_us > 0) {
        influence_to_remove++;
        original_us -= 2;
      }

      this.removeInfluence("egypt", influence_to_remove, "us");
      this.placeInfluence("egypt", 2, "ussr");
      this.updateStatus("<div class='status-message' id='status-message'>Nasser - Soviets add two influence in Egypt. US loses half (rounded-up) of all influence in Egypt.</div>");
      
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR plays ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS triggers ${this.cardToText(card)}.`);
        }
      }
      return 1;


    }





    //////////
    // NATO //
    //////////
    if (card == "nato") {

      if (this.game.state.events.marshall == 1 || this.game.state.events.warsawpact == 1) {
        this.game.state.events.nato = 1;

        if (this.game.state.events.willybrandt == 0){
          this.game.state.events.nato_westgermany = 1;
        }
        if (this.game.state.events.degaulle == 0){
          this.game.state.events.nato_france = 1;
        }
        
        this.displayModal("NATO in effect");

      } else {
        this.updateLog("NATO cannot trigger before Warsaw Pact or Marshall Plan. Moving to discard pile.");
      }
      return 1;
    }





    //
    // Nazi Scientist
    //
    if (card == "naziscientist") {
      this.advanceSpaceRace(player);
      return 1;
    }




    //
    // Nixon Plays the China Card
    //
    if (card == "nixon") {

      let does_us_get_vp = 0;

      if (this.game.state.events.china_card == 2) {
        does_us_get_vp = 1;
      } else {

        if (this.game.state.events.china_card == 1) {
          this.game.state.events.china_card = 2;
          this.game.state.events.china_card_facedown = 1;
          this.displayChinaCard();
        } else {

          if (this.game.player == 2) {
            for (let i = 0; i < this.game.deck[0].hand.length; i++) {
              if (this.game.deck[0].hand[i] == "china") {
                does_us_get_vp = 1;
              }
            }
          }
          if (this.game.player == 1) {
            does_us_get_vp = 1;
            for (let i = 0; i < this.game.deck[0].hand.length; i++) {
              if (this.game.deck[0].hand[i] == "china") {
                does_us_get_vp = 0;
              }
            }
          }
        }
      }

      if (does_us_get_vp == 1) {
        this.game.state.vp += 2;
        this.updateVictoryPoints();
        this.updateLog("US gets 2 VP from Nixon");
      } else {
        if (this.game.player == 1) {
          for (let i = 0; i < this.game.deck[0].hand.length; i++) {
            if (this.game.deck[0].hand[i] == "china") {
              this.updateLog("US gets the China Card (face down)");
              this.game.deck[0].hand.splice(i, 1);
            }
          }
        }
        this.game.state.events.china_card = 2;
        this.game.state.events.china_card_facedown = 1;
        this.displayChinaCard();
      }

     if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }


      return 1;
    }





    //
    // Norad
    //
    if (card == "norad") {
      this.game.state.events.norad = 1;

     if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }

      return 1;
    }




    //
    // North Sea Oil
    //
    if (card == "northseaoil") {
      this.game.state.events.northseaoil = 1; //block OPEC
      this.game.state.events.northseaoil_bonus = 1; //let US play 8 cards
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }




    //
    // Nuclear Subs
    //
    if (card == "nuclearsubs") {
      this.game.state.events.nuclearsubs = 1;
       if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }





    //////////////////////
    // Nuclear Test Ban //
    //////////////////////
    if (card == "nucleartestban") {

      let vpchange = this.game.state.defcon-2;
      if (vpchange < 0) { vpchange = 0; }
      this.game.state.defcon = this.game.state.defcon+2;
      if (this.game.state.defcon > 5) { this.game.state.defcon = 5; }

      if (player == "us") {
        this.game.state.vp = this.game.state.vp+vpchange;
      } else {
        this.game.state.vp = this.game.state.vp-vpchange;
      }
      this.updateVictoryPoints();
      this.updateDefcon();

      if (!i_played_the_card){
        this.game.queue.push(`ACKNOWLEDGE\t${player.toUpperCase()} plays ${this.cardToText(card)}.`);
      }


      return 1;
    }





    //
    // OAS
    //
    if (card == "oas") {

      if (this.game.player == 1) {
        return 0;
      }
      if (this.game.player == 2) {

        var twilight_self = this;
        twilight_self.playerFinishedPlacingInfluence();

        var ops_to_place = 2;

        twilight_self.addMove("resolve\toas");

        this.updateStatus("<div class='status-message' id='status-message'>US places two influence in Central or South America</div>");
        for (var i in this.countries) {
          if (this.countries[i].region == "samerica" || this.countries[i].region == "camerica"){
            this.countries[i].place = 1;
            $("#"+i).addClass("westerneurope");
          }
        }

          //if (i == "venezuela" || i == "colombia" || i == "ecuador" || i == "peru" || i == "chile" || i == "bolivia" || i == "argentina" || i == "paraguay" || i == "uruguay" || i == "brazil" || i == "mexico" || i == "guatemala" || i == "elsalvador" || i == "honduras" || i == "nicaragua" || i == "costarica" || i == "panama" || i == "cuba" || i == "haiti" || i == "dominicanrepublic") {

          $(".westerneurope").off();
          $(".westerneurope").on('click', function() {
            let countryname = $(this).attr('id');
            if (twilight_self.countries[countryname].place == 1) {
                twilight_self.addMove("place\tus\tus\t"+countryname+"\t1");
                twilight_self.placeInfluence(countryname, 1, "us");
              } else {
                twilight_self.displayModal("you cannot place there...");
              }
          
              ops_to_place--;
              if (ops_to_place == 0) {
                twilight_self.playerFinishedPlacingInfluence();
                twilight_self.endTurn();
              }
                
            });
          
        
        return 0;
      }
    }





    ///////////////////
    // Olympic Games //
    ///////////////////
    if (card == "olympic") {

      let me = "ussr";
      let opponent = "us";
      if (this.game.player == 2) { opponent = "ussr"; me = "us"; }

      if (player == me) {
        this.updateStatus(`<div class='status-message' id='status-message'>${opponent.toUpperCase()} is deciding whether to boycott the ${this.cardToText(card)}</div>`);
        this.attachCardboxEvents();
        return 0;
      } else {

        let twilight_self = this;

        this.addMove("resolve\tolympic");

        twilight_self.updateStatusWithOptions(`${opponent.toUpperCase()} hosts the ${this.cardToText(card)}:`,'<ul><li class="card" id="boycott">boycott</li><li class="card" id="participate">participate</li></ul>',false);

        twilight_self.attachCardboxEvents(function(action) {

          if (action == "boycott") {
            twilight_self.addMove("ops\t"+opponent+"\tolympic\t4");
            twilight_self.addMove("setvar\tgame\tstate\tback_button_cancelled\t1");
            twilight_self.addMove("defcon\tlower");
            twilight_self.addMove("modal\t"+me.toUpperCase()+" boycotts the Olympics");
            twilight_self.addMove("NOTIFY\t"+me.toUpperCase()+" boycotts the Olympics, "+opponent.toUpperCase()+" gets 4 OPS");
            twilight_self.endTurn();
            return;
          }
          if (action == "participate") {

            let winner = 0;

            while (winner == 0) {

              let usroll   = twilight_self.rollDice(6);
              let ussrroll = twilight_self.rollDice(6);

              twilight_self.addMove("dice\tburn\t"+player);
              twilight_self.addMove("dice\tburn\t"+player);

              if (opponent == "us") {
                usroll += 2;
              } else {
                ussrroll += 2;
              }

              if (ussrroll > usroll) {
                twilight_self.addMove("vp\tussr\t2");
                twilight_self.addMove("NOTIFY\tOlympic Games: USSR rolls "+ussrroll+" / US rolls "+usroll);
                twilight_self.addMove("modal\t USSR wins the Olympics");
                twilight_self.endTurn();
                winner = 1;
              }
              if (usroll > ussrroll) {
                twilight_self.addMove("vp\tus\t2");
                twilight_self.addMove("NOTIFY\tOlympic Games: USSR rolls "+ussrroll+" / US rolls "+usroll);
                twilight_self.addMove("modal\t US wins the Olympics");
                twilight_self.endTurn();
                winner = 2;
              }
            }
          }
        });
      }

      return 0;
    }






    if (card == "onesmallstep") {
      if (player == "us") {
        if (this.game.state.space_race_us < this.game.state.space_race_ussr) {
          this.updateLog("US takes one small step into space...");
          this.advanceSpaceRace("us");
          this.advanceSpaceRace("us");
        }
      } else {
        if (this.game.state.space_race_ussr < this.game.state.space_race_us) {
          this.updateLog("USSR takes one small step into space...");
          this.advanceSpaceRace("ussr");
          this.advanceSpaceRace("ussr");
        }
      }

      if (!i_played_the_card){
        this.game.queue.push(`ACKNOWLEDGE\t${player.toUpperCase()} plays ${this.cardToText(card)}.`);
      }

      return 1;
    }



  if (card == "opec") {

    if (this.game.state.events.northseaoil == 1) {
      this.updateLog(`${this.cardToText(card)} prevented by ${this.cardToText("northseaoil")}`);
      return 1;
    }

    let ussr_bonus = 0;

    if (this.isControlled("ussr", "egypt") == 1)       { ussr_bonus++; }
    if (this.isControlled("ussr", "iran") == 1)        { ussr_bonus++; }
    if (this.isControlled("ussr", "libya") == 1)       { ussr_bonus++; }
    if (this.isControlled("ussr", "saudiarabia") == 1) { ussr_bonus++; }
    if (this.isControlled("ussr", "gulfstates") == 1)  { ussr_bonus++; }
    if (this.isControlled("ussr", "iraq") == 1)        { ussr_bonus++; }
    if (this.isControlled("ussr", "venezuela") == 1)   { ussr_bonus++; }

    this.game.state.vp -= ussr_bonus;
    this.updateVictoryPoints();
    this.updateLog("<span>USSR VP bonus is:</span> " + ussr_bonus);

    if (!i_played_the_card){
      if (player == "ussr"){
        this.game.queue.push(`ACKNOWLEDGE\tUSSR plays ${this.cardToText(card)}.`);
      }else{
        this.game.queue.push(`ACKNOWLEDGE\tUS triggers ${this.cardToText(card)}.`);
      }
    }

    return 1;

  }


    if (card == "ortega") {
      
      let purginf = this.countries["nicaragua"].us;
      this.removeInfluence("nicaragua", purginf, "us");
      
      let can_coup = 0;

      if (this.countries["cuba"].us > 0) { can_coup = 1; }
      if (this.countries["honduras"].us > 0) { can_coup = 1; }
      if (this.countries["costarica"].us > 0) { can_coup = 1; }


      if (can_coup == 0) {
        this.updateLog("notify\tUSSR does not have valid coup target");
        return 1;
      }

      if (this.game.state.events.cubanmissilecrisis == 1) {
        this.updateStatus("<div class='status-message' id='status-message'>USSR is under Cuban Missile Crisis and cannot coup. Skipping Ortega coup.</div>");
        this.updateLog("USSR is under Cuban Missile Crisis and cannot coup. Skipping Ortega coup.");
        return 1;
      }

      if (this.game.player == 2){
        return 0;
      }

      let twilight_self = this;
      let neighbors = ["costarica","cuba","honduras"];      

      twilight_self.updateStatusWithOptions("Pick a country adjacent to Nicaragua to coup:", '<ul><li class="card" id="skiportega">or skip coup</li></ul>',false);

      //To Skip the Coup
      twilight_self.attachCardboxEvents(function(action2) {
        if (action2 == "skiportega") {
          twilight_self.updateStatus("<div class='status-message' id='status-message'>Skipping Ortega coup...</div>");
          twilight_self.addMove("resolve\tortega");
          twilight_self.endTurn();
        }
      })

      //To Launch the Coup


      for (var c of neighbors) {
        $("#"+c).addClass("easterneurope");
      }

      $(".easterneurope").off();
      $(".easterneurope").on('click', function() {
        let c = $(this).attr('id');

        if (twilight_self.countries[c].us>0){
          twilight_self.playerFinishedPlacingInfluence();
          twilight_self.addMove("resolve\tortega");
          twilight_self.addMove("unlimit\tmilops");
          twilight_self.addMove("coup\tussr\t"+c+"\t2");
          twilight_self.addMove("limit\tmilops");
          twilight_self.addMove("notify\tUSSR launches coup in "+twilight_self.countries[c].name + " with " + twilight_self.cardToText(card));
          twilight_self.endTurn();  
        }else{
          twilight_self.displayModal("Invalid Target", "No US influence to coup");
        }
      });   
      
      return 0;
    }






    //
    // Panama Canal
    //
    if (card == "panamacanal") {
      this.placeInfluence("panama", 1, "us");
      this.placeInfluence("venezuela", 1, "us");
      this.placeInfluence("costarica", 1, "us");
       if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }



    //
    // Pershing II Deployed
    //
    if (card == "pershing") {

      if (this.game.player == 2) {
        return 0;

      }
      if (this.game.player == 1) {

        var twilight_self = this;
        this.updateStatus(`<div class='status-message' id='status-message'>${this.cardToText(card)}: Remove 3 US influence from Western Europe (max 1 per country)</div>`);
        
        twilight_self.playerFinishedPlacingInfluence();

        twilight_self.addMove("resolve\tpershing");
        twilight_self.addMove("vp\tussr\t1");

        let valid_targets = [];
        for (var countryname in this.countries) {
          if (countryname == "turkey" ||
              countryname == "greece" ||
              countryname == "spain" ||
              countryname == "italy" ||
              countryname == "france" ||
              countryname == "canada" ||
              countryname == "uk" ||
              countryname == "benelux" ||
              countryname == "denmark" ||
              countryname == "austria" ||
              countryname == "norway" ||
              countryname == "sweden" ||
              countryname == "finland" ||
              countryname == "westgermany"){
            if (this.countries[countryname].us > 0) {
              valid_targets.push(countryname);
              this.countries[countryname].place = 1;
              $("#"+countryname).addClass("easterneurope");
            }  
          }
        }

        if (valid_targets.length == 0) {
          twilight_self.addMove("NOTIFY\tUS does not have any targets for "+ twilight_self.cardToText(card));
          twilight_self.endTurn();
          return;
        }

        var ops_to_purge = Math.min(valid_targets.length, 3);

        $(".easterneurope").off();
        $(".easterneurope").on('click', function() {

          let c = $(this).attr('id');

          if (twilight_self.countries[c].place != 1) {
            twilight_self.displayModal("Invalid Country");
          } else {
            twilight_self.countries[c].place = 0;
            twilight_self.removeInfluence(c, 1, "us");
            
            twilight_self.addMove("remove\tussr\tus\t"+c+"\t1");
            ops_to_purge--;
            if (ops_to_purge == 0) {
              twilight_self.playerFinishedPlacingInfluence();
              twilight_self.endTurn();
            }  
            twilight_self.updateStatus(`<div class='status-message' id='status-message'>${twilight_self.cardToText(card)}: Remove ${ops_to_purge} US influence from Western Europe (max 1 per country)</div>`);
          }
        });
      }
      return 0;
    }




    //
    // Portuguese Empire Crumbles
    //
    if (card == "portuguese") {
      this.placeInfluence("seafricanstates", 2, "ussr");
      this.placeInfluence("angola", 2, "ussr");
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR plays ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS triggers ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }




    if (card == "puppet") {

      if (this.game.player == 1) {
        //this.updateStatus(`<div class='status-message' id='status-message'>US is playing ${this.cardToText(card)}</div>`);
        return 0;
      }
      if (this.game.player == 2) {

        var twilight_self = this;
        twilight_self.playerFinishedPlacingInfluence();

        var ops_to_place = 3;
        var available_targets = 0;

        twilight_self.addMove("resolve\tpuppet");

        this.updateStatus("<div class='status-message' id='status-message'>US place three influence in countries without any influence</div>");

        for (var i in this.countries) {

          let countryname  = i;
          let divname      = '#'+i;

          if (twilight_self.countries[countryname].us == 0 && twilight_self.countries[countryname].ussr == 0) {

            available_targets++;
            twilight_self.countries[countryname].place = 1;

            $(divname).off();
            $(divname).on('click', function() {
              let countryname = $(this).attr('id');
              if (twilight_self.countries[countryname].place == 1) {
                twilight_self.addMove("place\tus\tus\t"+countryname+"\t1");
                twilight_self.placeInfluence(countryname, 1, "us", function() {
                  twilight_self.countries[countryname].place = 0;
                  ops_to_place--;
                  if (ops_to_place == 0) {
                    twilight_self.playerFinishedPlacingInfluence();
                    twilight_self.endTurn();
                  }
                });
              } else {
                twilight_self.displayModal("you cannot place there...");
              }
            });
          }
        }

        if (available_targets < ops_to_place) { 
          ops_to_place = available_targets; 
        }

        //Safety catch if nowhere to place at all
        if (ops_to_place == 0) {
          twilight_self.playerFinishedPlacingInfluence();
          twilight_self.endTurn();
        } 
        
        return 0;
      }
    }





    //
    // Quagmire
    //
    if (card == "quagmire") {
      this.game.state.events.norad = 0;
      this.game.state.events.quagmire = 1;
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR plays ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS triggers ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }




    if (card == "reagan") {

      let us_vp = 0;
      let x = this.countries["libya"].ussr;

      if (x >= 2) {
        while (x > 1) {
          x -= 2;
          us_vp++;
        }
        this.updateLog("<span>Reagan bombs Libya and US scores</span> "+us_vp+" <span>VP</span>");
        this.game.state.vp += us_vp;
        this.updateVictoryPoints();
      }
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }






    ///////////////
    // Red Scare //
    ///////////////
    if (card == "redscare") {
      if (player == "ussr") { this.game.state.events.redscare_player2 += 1; }
      if (player == "us") { this.game.state.events.redscare_player1 += 1; }
      
      if (!i_played_the_card){
        this.game.queue.push(`ACKNOWLEDGE\t${player.toUpperCase()} plays ${this.cardToText(card)}.`);
      }
      return 1;
    }




    if (card == "reformer") {

      this.game.state.events.reformer = 1;

      if (this.game.player == 2) {
        return 0;
      }
      if (this.game.player == 1) {

        var twilight_self = this;
        twilight_self.playerFinishedPlacingInfluence();

        let influence_to_add = (this.game.state.vp < 0)? 6: 4;

        this.addMove("resolve\treformer");
        this.updateStatus(`<div class="status-message" id="status-message">${twilight_self.cardToText(card)}: Add ${influence_to_add} influence in Europe (max 2 per country)</div>`);

        var ops_placed = {};

        for (var i in twilight_self.countries) {
          if (this.countries[i].region == "europe") {
            ops_placed[i] = 0;
            $("#"+i).addClass("easterneurope");  
          }
        }

        $(".easterneurope").off();
        $(".easterneurope").on('click', function() {

          let c = $(this).attr('id');

          if (ops_placed[c] >= 2) {
            twilight_self.displayModal("Invalid Placement");
          } else {
            ops_placed[c]++;
            twilight_self.placeInfluence(c, 1, "ussr");
            twilight_self.addMove("place\tussr\tussr\t"+c+"\t1");

            influence_to_add--;

            if (influence_to_add == 0) {
              twilight_self.playerFinishedPlacingInfluence();
              twilight_self.endTurn();
            }
            twilight_self.updateStatus(`<div class="status-message" id="status-message">${twilight_self.cardToText(card)}: Add ${influence_to_add} influence in Europe (max 2 per country)</div>`);
          }
        });
         
        return 0;
      }

      
    }



    /////////////////////////
    // Romanian Abdication //
    /////////////////////////
    if (card == "romanianab") {
      let usinf = parseInt(this.countries['romania'].us);
      let ussrinf = parseInt(this.countries['romania'].ussr);
      this.removeInfluence("romania", usinf, "us");
      if (ussrinf < 3) {
        this.placeInfluence("romania", (3-ussrinf), "ussr");
      }
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR plays ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS triggers ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }





    //
    // Sadat Expels Soviets
    //
    if (card == "sadat") {
      if (this.countries["egypt"].ussr > 0) {
        this.removeInfluence("egypt", this.countries["egypt"].ussr, "ussr");
      }
      this.placeInfluence("egypt", 1, "us");
       if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }





    //
    // Salt Negotiations
    //
    if (card == "saltnegotiations") {

      // update defcon
      this.game.state.defcon += 2;
      if (this.game.state.defcon > 5) { this.game.state.defcon = 5; }
      this.updateDefcon();

      // affect coups
      this.game.state.events.saltnegotiations = 1;

      // otherwise sort through discards
      let discardlength = 0;
      for (var i in this.game.deck[0].discards) { discardlength++; }
      if (discardlength == 0) {
        this.updateLog("No cards in discard pile");
        return 1;
      }


      if (!i_played_the_card) {
        return 0;
      }

      // pick discarded card
      var twilight_self = this;

      let discard_deck = [];
      for (var i in this.game.deck[0].discards) {
	// edge-case bug where scoring is not in scoring card (???)
	try {
          if (this.game.deck[0].discards[i].scoring == 0) {
            if (this.game.state.events.shuttlediplomacy == 0 || (this.game.state.events.shuttlediplomacy == 1 && i != "shuttle")) {
              discard_deck.push(i);
              console.log(i);
              //html += '<li class="card" id="'+i+'">'+this.game.deck[0].discards[i].name+'</li>';
            }
          }
        } catch (err) {
	  console.log("ERROR: please check scoring error in SALT for card: " + i);
	}
      }
      
      twilight_self.updateStatusAndListCards("Choose Card to Reclaim:",discard_deck,true);
      twilight_self.addMove("resolve\tsaltnegotiations");

      twilight_self.attachCardboxEvents(function(action2) {
        twilight_self.game.deck[0].hand.push(action2);
        twilight_self.addMove("NOTIFY\t"+player.toUpperCase() +" retrieved "+twilight_self.cardToText(action2));
        twilight_self.addMove("undiscard\t"+action2); 
        twilight_self.endTurn();
      });

      twilight_self.bindBackButtonFunction(()=>{
        twilight_self.addMove("NOTIFY\t"+player.toUpperCase() +" does not retrieve card");
        twilight_self.endTurn();
      })
                
      return 0;
    }




    if (card == "seasia") {
      let vp_adjustment = this.calculateScoring("seasia");
      this.showScoreOverlay(card, vp_adjustment);
      let total_vp = vp_adjustment.us.vp - vp_adjustment.ussr.vp;
      this.game.state.vp += total_vp;
      this.updateLog("<span>Southeast Asia:</span> " + total_vp + " <span>VP</span>");

      // stats
      if (player == "us") { this.game.state.stats.us_scorings++; }
      if (player == "ussr") { this.game.state.stats.ussr_scorings++; }


      this.updateVictoryPoints();
      return 1;
    }



    //
    // Shuttle Diplomacy
    //
    if (card == "shuttle") {
      this.game.state.events.shuttlediplomacy = 1;
       if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }





    ///////////////////////////
    // Socialist Governments //
    ///////////////////////////
    if (card == "socgov") {

      if (this.game.state.events.ironlady == 1) {
        this.updateLog("Iron Lady cancels Socialist Governments");
        this.updateStatus("Socialist Governments prevented by Iron Lady");
        return 1;
      }

      if (this.game.player == 2) {
        //this.updateStatus(`<div class='status-message' id='status-message'>Waiting for USSR to play ${this.cardToText(card)}</div>`);
        return 0;
      }
      if (this.game.player == 1) {

        var twilight_self = this;
        //twilight_self.playerFinishedPlacingInfluence();

        twilight_self.addMove("resolve\tsocgov");

        var ops_to_purge = 3;
        var ops_purged = {};
        var available_targets = 0;

        const europeanCountries = ["italy", "turkey", "greece", "spain", "france", "westgermany", "uk", "canada", "benelux", "finland", "austria", "denmark", "norway", "sweden"]; 

        for (var i of europeanCountries) {
          if (twilight_self.countries[i].us == 1) { available_targets += 1; }
          if (twilight_self.countries[i].us > 1) { available_targets += 2; }

          if (twilight_self.countries[i].us > 0){
            $("#"+i).addClass("easterneurope");
            twilight_self.countries[i].place = 1;  
            ops_purged[i] = 0;
          }

        }
        
        if (available_targets == 0){
          this.endTurn();
        }

        ops_to_purge = Math.min(3, available_targets);
        
        this.updateStatus("<div class='status-message' id='status-message'>Remove "+ops_to_purge+" US influence from Western Europe (max 2 per country)</div>");
        
        $(".easterneurope").off();
        $(".easterneurope").on('click', function() {
          let c = $(this).attr('id');
          if (twilight_self.countries[c].place != 1) {
            twilight_self.displayModal("Invalid Country");
          } else {
            ops_purged[c]++;
            if (ops_purged[c] >= 2) {
              twilight_self.countries[c].place = 0;
            }
            twilight_self.removeInfluence(c, 1, "us");
            twilight_self.addMove("remove\tussr\tus\t"+c+"\t1");
            ops_to_purge--;
            if (ops_to_purge == 0) {
              twilight_self.playerFinishedPlacingInfluence();
              twilight_self.endTurn();
            }
          }
        });
      
      }
        return 0;
    }


    //
    // Solidarity
    //
    if (card == "solidarity") {
      if (this.game.state.events.johnpaul == 0) {
        this.updateLog(`${this.cardToText(card)} does not trigger because no ${this.cardToText("johnpaul")}`);
        return 1;
      }
      this.placeInfluence("poland", 3, "us");
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }


      return 1;
    }




    if (card == "southafrican") {

      if (this.game.player == 2) {
        //this.updateStatus("<div class='status-message' id='status-message'>USSR is playing South African Unrest</div>");
        return 0;

      }
      if (this.game.player == 1) {

        var twilight_self = this;
        twilight_self.playerFinishedPlacingInfluence();

        twilight_self.updateStatusWithOptions(`${twilight_self.cardToText(card)}: `,'<ul><li class="card" id="southafrica">2 Influence in South Africa</li><li class="card" id="adjacent">1 Influence in South Africa and 2 Influence in an adjacent country</li></ul>',false);

        twilight_self.attachCardboxEvents(function(action2) {
          twilight_self.addMove("resolve\tsouthafrican");

          if (action2 == "southafrica") {

            twilight_self.placeInfluence("southafrica", 2, "ussr", function() {
              twilight_self.addMove("place\tussr\tussr\tsouthafrica\t2");
              twilight_self.endTurn();
            });
            return 0;

          }
          if (action2 == "adjacent") {

            twilight_self.placeInfluence("southafrica", 1, "ussr");
            twilight_self.addMove("place\tussr\tussr\tsouthafrica\t1");

              twilight_self.updateStatus("<div class='status-message' id='status-message'>Place two influence in a neighboring country</div>");
              let neighbors = ["angola", "botswana"];
    
              for (var i of neighbors) {
                $("#"+i).addClass("easterneurope");
              }

              $(".easterneurope").off();
              $(".easterneurope").on('click', function() {
                let c = $(this).attr('id');
                twilight_self.placeInfluence(c, 2, "ussr");
                twilight_self.addMove("place\tussr\tussr\t"+c+"\t2");
                twilight_self.playerFinishedPlacingInfluence();
                twilight_self.endTurn();
              });
          }
        });
        return 0;
      }
    }




    if (card == "samerica") {
      let vp_adjustment = this.calculateScoring("samerica");
      this.showScoreOverlay(card, vp_adjustment);
      let total_vp = vp_adjustment.us.vp - vp_adjustment.ussr.vp;
      this.game.state.vp += total_vp;
      this.updateLog("<span>South America:</span> " + total_vp + " <span>VP</span>");

      // stats
      if (player == "us") { this.game.state.stats.us_scorings++; }
      if (player == "ussr") { this.game.state.stats.ussr_scorings++; }


      this.updateVictoryPoints();
      return 1;
    }



    if (card == "specialrelation") {

      if (this.isControlled("us", "uk") == 1) {

        if (this.game.player == 1) {
          return 0;
        }
        
        let twilight_self = this;
        let ops_to_place = 1;
        let placeable = [];

        twilight_self.addMove("resolve\tspecialrelation");
        
        if (this.game.state.events.nato == 1) {
          twilight_self.addMove("vp\tus\t2");
          ops_to_place = 2;
          placeable.push("canada");
          placeable.push("uk");
          placeable.push("italy");
          placeable.push("france");
          placeable.push("spain");
          placeable.push("greece");
          placeable.push("turkey");
          placeable.push("austria");
          placeable.push("benelux");
          placeable.push("westgermany");
          placeable.push("denmark");
          placeable.push("norway");
          placeable.push("sweden");
          placeable.push("finland");
          this.updateStatus("<div class='status-message' id='status-message'>US is playing Special Relationship. Place 2 OPS anywhere in Western Europe.");

        } else {

          this.updateStatus("<div class='status-message' id='status-message'>US is playing Special Relationship. Place 1 OP adjacent to the UK.</div>");
          placeable.push("canada");
          placeable.push("france");
          placeable.push("norway");
          placeable.push("benelux");
        }

        for (let i of placeable) {
          $("#"+i).addClass("westerneurope");
        }

        $(".westerneurope").off();
        $(".westerneurope").on('click', function() {
            let c = $(this).attr('id');
            twilight_self.placeInfluence(c, ops_to_place, "us");
            twilight_self.addMove("place\tus\tus\t"+c+"\t"+ops_to_place);
            twilight_self.playerFinishedPlacingInfluence();
            twilight_self.endTurn();
          });
        return 0;
      }else{
        this.updateLog(`${this.cardToText(card)} doesn't trigger because UK not controlled by US`);
      }
      return 1;
    }



    if (card == "starwars") {

      if (this.game.state.space_race_us <= this.game.state.space_race_ussr) {
        this.updateLog(`US is not ahead of USSR in the space race (${this.cardToText(card)})`);
        return 1;
      }

      this.game.state.events.starwars = 1;

      // otherwise sort through discards
    
      let discard_deck = [];

      var twilight_self = this;

      this.addMove("resolve\tstarwars");

      let html = "<ul>";
      for (var i in this.game.deck[0].discards) {
        if (this.game.state.headline == 1 && i == "unintervention") {} else {
          if (this.game.deck[0].cards[i] != undefined) {
            if (this.game.deck[0].cards[i].name != undefined) {
              if (this.game.deck[0].cards[i].scoring != 1) {
                if (this.game.state.events.shuttlediplomacy == 0 || (this.game.state.events.shuttlediplomacy == 1 && i != "shuttle")) {
                  discard_deck.push(i);
                } 
              }
            }
          }
        }
      }

      if (discard_deck.length == 0) {
        twilight_self.addMove(`NOTIFY\tUS cannot use ${this.cardToText(card)} as no cards to retrieve`);
        twilight_self.endTurn();
        return 1;
      }

      if (this.game.player == 1) {
        return 0;
      }


      twilight_self.updateStatusAndListCards(`${this.cardToText(card)}: Choose card to play immediately:`,html,false);
      twilight_self.attachCardboxEvents(function(action2) {
        twilight_self.addMove("event\tus\t"+action2);
        twilight_self.addMove("NOTIFY\t"+player+" retrieved "+twilight_self.cardToText(action2));
        twilight_self.addMove("undiscard\t"+action2);
        twilight_self.endTurn();
      });

      return 0;
    }



    /////////////////
    // Suez Crisis //
    /////////////////
    if (card == "suezcrisis") {

      if (this.game.player == 2) {
        //this.updateStatus("<div class='status-message' id='status-message'>USSR is playing Suez Crisis</div>");
        return 0;
      }
      if (this.game.player == 1) {

        var twilight_self = this;

        twilight_self.addMove("resolve\tsuezcrisis");
        twilight_self.updateStatus("<div class='status-message' id='status-message'>Remove four influence from Israel, UK or France</div>");

        var ops_to_purge = 4;
        var options_purge = [];
        var options_available = 0;
        let options_purged = {};

        var israel_ops = twilight_self.countries['israel'].us;
        var uk_ops = twilight_self.countries['uk'].us;
        var france_ops = twilight_self.countries['france'].us;

        if (israel_ops > 2) { israel_ops = 2; }
        if (uk_ops > 2)     { uk_ops = 2; }
        if (france_ops > 2) { france_ops = 2; }

        options_available = israel_ops + uk_ops + france_ops;

        if (options_available <= 4) {

          this.updateLog("Suez Crisis auto-removed available influence");

          if (israel_ops >= 2) { israel_ops = 2; } else {}
          if (uk_ops >= 2) { uk_ops = 2; } else {}
          if (france_ops >= 2) { france_ops = 2; } else {}

          if (israel_ops > 0) {
            twilight_self.removeInfluence("israel", israel_ops, "us");
              twilight_self.addMove("remove\tussr\tus\tisrael\t"+israel_ops);
          }
          if (france_ops > 0) {
            twilight_self.removeInfluence("france", france_ops, "us");
            twilight_self.addMove("remove\tussr\tus\tfrance\t"+france_ops);
          }
          if (uk_ops > 0) {
            twilight_self.removeInfluence("uk", uk_ops, "us");
            twilight_self.addMove("remove\tussr\tus\tuk\t"+uk_ops);
          }
          twilight_self.endTurn();

        } else {

          if (twilight_self.countries['uk'].us > 0) { options_purge.push('uk'); }
          if (twilight_self.countries['france'].us > 0) { options_purge.push('france'); }
          if (twilight_self.countries['israel'].us > 0) { options_purge.push('israel'); }

          for (let m = 0; m < options_purge.length; m++) {

            let countryname = options_purge[m];
            options_purged[countryname] = 0;

            let divname      = '#'+countryname;
            $(divname).addClass("easterneurope");

            $(divname).off();
            $(divname).on('click', function() {

              let c = $(this).attr('id');

              if (options_purged[c] >= 2) {
                twilight_self.displayModal("Invalid Option");
              } else {
                twilight_self.removeInfluence(c, 1, "us");
                twilight_self.addMove("remove\tussr\tus\t"+c+"\t1");
                options_purged[c]++;
                
                ops_to_purge--;
                if (ops_to_purge == 0) {
                  twilight_self.playerFinishedPlacingInfluence();
                  twilight_self.displayModal("All Influence Removed");
                  twilight_self.endTurn();
                }
              }
            });
          }
        }
      }
      return 0;
    }





    //
    // Summit
    //
    if (card == "summit") {

      let us_roll = this.rollDice(6);
      let ussr_roll = this.rollDice(6);
      let usbase = us_roll;
      let ussrbase = ussr_roll;

      if (this.doesPlayerDominateRegion("ussr", "europe") == 1)   { ussr_roll++; }
      if (this.doesPlayerDominateRegion("ussr", "mideast") == 1)  { ussr_roll++; }
      if (this.doesPlayerDominateRegion("ussr", "asia") == 1)     { ussr_roll++; }
      if (this.doesPlayerDominateRegion("ussr", "africa") == 1)   { ussr_roll++; }
      if (this.doesPlayerDominateRegion("ussr", "camerica") == 1) { ussr_roll++; }
      if (this.doesPlayerDominateRegion("ussr", "samerica") == 1) { ussr_roll++; }
      if (this.doesPlayerDominateRegion("ussr", "seasia") == 1) { ussr_roll++; }

      if (this.doesPlayerDominateRegion("us", "europe") == 1)   { us_roll++; }
      if (this.doesPlayerDominateRegion("us", "mideast") == 1)  { us_roll++; }
      if (this.doesPlayerDominateRegion("us", "asia") == 1)     { us_roll++; }
      if (this.doesPlayerDominateRegion("us", "africa") == 1)   { us_roll++; }
      if (this.doesPlayerDominateRegion("us", "camerica") == 1) { us_roll++; }
      if (this.doesPlayerDominateRegion("us", "samerica") == 1) { us_roll++; }
      if (this.doesPlayerDominateRegion("us", "seasia") == 1)   { us_roll++; }

      this.updateLog(`${this.cardToText(card)}: US rolls ${usbase} (${(us_roll - usbase)}) and USSR rolls ${ussrbase} (${(ussr_roll-ussrbase)})`);

      let is_winner = 0;

      if (us_roll > ussr_roll) { is_winner = 1; }
      if (ussr_roll > us_roll) { is_winner = 1; }

      if (is_winner == 0) {
        this.updateLog(`${this.cardToText(card)}: no winner`);
        this.displayModal(`${this.cardToText(card)}: no winner`);
        return 1;
      } else {

        //
        // winner
        //
        let my_go = 0;
        if (us_roll > ussr_roll && this.game.player == 2) { my_go = 1; }
        if (ussr_roll > us_roll && this.game.player == 1) { my_go = 1; }

        if (my_go == 1) {

          let twilight_self = this;

          twilight_self.addMove("resolve\tsummit");

          if (us_roll > ussr_roll) {
            twilight_self.updateLog("US receives 2 VP from Summit");
            twilight_self.addMove("vp\tus\t2");
          } else {
            twilight_self.updateLog("USSR receives 2 VP from Summit");
            twilight_self.addMove("vp\tussr\t2");
          }

          let x = 0;
          let y = 0;

          twilight_self.updateStatusWithOptions(`You win the ${twilight_self.cardToText(card)}:`,'<ul><li class="card" id="raise">raise DEFCON</li><li class="card" id="lower">lower DEFCON</li><li class="card" id="same">do not change</li></ul>',false);

          twilight_self.attachCardboxEvents(function(action2) {

            if (action2 == "raise") {
              twilight_self.addMove("defcon\traise");
              twilight_self.addMove("notify\tDEFCON is raised by 1");
              twilight_self.endTurn();
            }
            if (action2 == "lower") {
              twilight_self.addMove("defcon\tlower");
              twilight_self.addMove("notify\tDEFCON is lowered by 1");
              twilight_self.endTurn();
            }
            if (action2 == "same") {
              twilight_self.addMove("notify\tDEFCON left untouched");
              twilight_self.endTurn();
            }

          });
        }else{
          this.updateStatus(`You lost the ${this.cardToText(card)}, waiting for opponent to change DEFCON`);
        }
        return 0;
      }
    }





    if (card === "teardown") {

      this.game.state.events.teardown = 1;
      this.game.state.events.willybrandt = 0;
      if (this.game.state.events.nato == 1) {
        this.game.state.events.nato_westgermany = 1;
      }

      this.placeInfluence("eastgermany", 3, "us");
      
      this.game.queue.push("resolve\tteardown");
      this.game.queue.push("teardownthiswall\tus");
        
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }





    //
    // Our Man in Tehran
    //
    if (card == "tehran") {

      let usc = 0;

      if (this.isControlled("us", "egypt") == 1) { usc = 1; }
      if (this.isControlled("us", "libya") == 1) { usc = 1; }
      if (this.isControlled("us", "israel") == 1) { usc = 1; }
      if (this.isControlled("us", "lebanon") == 1) { usc = 1; }
      if (this.isControlled("us", "syria") == 1) { usc = 1; }
      if (this.isControlled("us", "iraq") == 1) { usc = 1; }
      if (this.isControlled("us", "iran") == 1) { usc = 1; }
      if (this.isControlled("us", "jordan") == 1) { usc = 1; }
      if (this.isControlled("us", "gulfstates") == 1) { usc = 1; }
      if (this.isControlled("us", "saudiarabia") == 1) { usc = 1; }

      if (usc == 0) {
        this.updateLog("US does not control any Middle-East Countries");
        return 1;
      }

      this.game.state.events.ourmanintehran = 1;

      if (this.game.player == 2) {
        return 0;
      }

      if (this.game.player == 1) {
        this.addMove("resolve\ttehran");
        let keys_given = 0;
        for (let i = 0; i < this.game.deck[0].crypt.length && i < 5; i++) {
          this.addMove(this.game.deck[0].keys[i]);
          keys_given++;
        }
        this.addMove("tehran\tussr\t"+keys_given);
        this.endTurn();
      }
      return 0;
    }




    if (card == "terrorism") {

      let twilight_self = this;
      let cards_to_discard = 1;
      let target = (player == "ussr")? "us": "ussr";
      
      if (target == "us") { if (this.game.state.events.iranianhostage == 1) { cards_to_discard = 2; } }

      this.addMove("resolve\tterrorism");

      if (target == this.playerRoles[this.game.player]) {

        let available_cards = this.game.deck[0].hand.length;
        let cards_for_select = [];
        for (let z = 0; z < this.game.deck[0].hand.length; z++) {
          if (this.game.deck[0].hand[z] === "china" || this.game.deck[0].hand[z] == this.game.state.headline_opponent_card || this.game.deck[0].hand[z] == this.game.state.headline_card) {} else {
            cards_for_select.push(this.game.deck[0].hand[z]);
          }
        }
        if (cards_for_select.length < cards_to_discard) { cards_to_discard = cards_for_select.length; }
        
        if (cards_to_discard == 0) { this.addMove(`NOTIFY\t${this.cardToText(card)}: ${target.toUpperCase()} has no cards to discard`); }

        for (let i = 0; i < cards_to_discard; i++) {
          if (cards_for_select.length > 0) {
            this.rollDice(cards_for_select.length, function(roll) {
              roll = parseInt(roll)-1;
              let victim = cards_for_select[roll];
              twilight_self.removeCardFromHand(victim);
              twilight_self.addMove("dice\tburn\t"+player);
              twilight_self.addMove(`discard\t${target}\t${victim}`);
              twilight_self.addMove(`modal\t${twilight_self.cardToText(card)}\t${target.toUpperCase()} discarded ${twilight_self.cardToText(victim)}`);
              cards_for_select.splice(roll, 1);
            });
          }
        }
        this.endTurn();
      }
      
      return 0;
    }






    ////////////
    // Truman //
    ////////////
    if (card == "truman") {

      var twilight_self = this;

      var options_purge = [];
      for (var i in this.countries) {
        if (this.countries[i].region === "europe") {
          if (twilight_self.countries[i].ussr > 0 && twilight_self.whoControls(i) == "") { 
            options_purge.push(i); 
          }
        }
      }

      if (options_purge.length == 0) {
        this.updateLog("USSR has no influence that can be removed by Truman");
        return 1;
      }

      if (options_purge.length == 1) {
        twilight_self.removeInfluence(options_purge[0], twilight_self.countries[options_purge[0]].ussr, "ussr");
        this.updateLog("Truman removes all USSR influence from " + options_purge[0]);
        return 1;
      }


      if (this.game.player == 1) {
        //this.updateStatus("<div class='status-message' id='status-message'>US is selecting target for Truman</div>");
        return 0;

      }

      if (this.game.player == 2) {

        for (let i of options_purge) {
          $(`#${i}`).addClass("westerneurope");
          this.countries[i].place = 1;
        }

        twilight_self.updateStatus("<div class='status-message' id='status-message'>Select a non-controlled country in Europe to remove all USSR influence: </div>");
        twilight_self.addMove("resolve\ttruman");
        
        $(".westerneurope").off();
        $(".westerneurope").on('click', function() {
          let c = $(this).attr('id');
          let ussrpur = twilight_self.countries[c].ussr;
          twilight_self.removeInfluence(c, ussrpur, "ussr");
          twilight_self.addMove(`NOTIFY\t${twilight_self.cardToText(card)}: US removes all USSR influence from `+twilight_self.countries[c].name);
          twilight_self.addMove("remove\tus\tussr\t"+c+"\t"+ussrpur);
          twilight_self.playerFinishedPlacingInfluence();
          twilight_self.endTurn();
        });
        
      }

      return 0;
    }





    //
    // U2 Incident
    //
    if (card == "u2") {

      this.game.state.events.u2 = 1;
      this.game.state.vp -= 1;
      this.updateVictoryPoints();
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR plays ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS triggers ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }




    /////////////////////
    // UN Intervention //
    /////////////////////
    if (card == "unintervention") {

      this.game.state.events.unintervention = 1;
      this.game.state.cancel_back_button = 1;

      let me = "ussr";
      let opponent = "us";
      if (this.game.player == 2) { opponent = "ussr"; me = "us"; }

      if (player != me) {
        return 0;
      } else {

        let twilight_self = this;

        //
        // U2
        //
        if (twilight_self.game.state.events.u2 == 1) {
          twilight_self.addMove("notify\tU2 activates and triggers +1 VP for USSR");
          twilight_self.addMove("vp\tussr\t1\t1");
        }

        //
        // let player pick another turn
        //
        this.addMove("resolve\tunintervention");
        this.addMove("play\t"+this.game.player);
        //this.addMove("setvar\tgame\tstate\tback_button_cancelled\t1");

        this.playerTurn();
        return 0;
      }

    }



    /////////////////////////
    // US / Japan Alliance //
    /////////////////////////
    if (card == "usjapan") {
      this.game.state.events.usjapan = 1;
      let usinf = parseInt(this.countries['japan'].us);
      let ussrinf = parseInt(this.countries['japan'].ussr);
      let targetinf = ussrinf + 4;
      if (usinf < (ussrinf +4)){
        this.placeInfluence("japan", (targetinf - usinf), "us");
      }
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR triggers ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS plays ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }





    if (card == "ussuri") {

      let us_cc = 0;

      //
      // does us have cc
      //
      if (this.game.state.events.china_card == 2) {
        us_cc = 1;
      } else {

        //
        // it is in one of our hands
        //
        if (this.game.player == 1) {

          let do_i_have_cc = 0;

          if (this.game.state.events.china_card == 1) { do_i_have_cc = 1; }

          for (let i = 0; i < this.game.deck[0].hand.length; i++) {
                if (this.game.deck[0].hand[i] == "china") {
              do_i_have_cc = 1;
            }
          }

          if (do_i_have_cc == 1) {
          } else {
            us_cc = 1;
          }

        }
        if (this.game.player == 2) {
          for (let i = 0; i < this.game.deck[0].hand.length; i++) {
                if (this.game.deck[0].hand[i] == "china") {
              us_cc = 1;
            }
          }
        }
      }

      if (us_cc == 1) {

        this.updateLog("US places 4 influence in Asia (max 2 per country)");

        //
        // place four in asia
        //
        if (this.game.player == 1) {
          this.updateStatus("<div class='status-message' id='status-message'>US is playing USSURI River Skirmish</div>");
          return 0;

        }
        if (this.game.player == 2) {

          var twilight_self = this;
          twilight_self.playerFinishedPlacingInfluence();

          var ops_to_place = 4;
          twilight_self.addMove("resolve\tussuri");

          this.updateStatus("<div class='status-message' id='status-message'>US place four influence in Asia (2 max per country)</div>");

          for (var i in this.countries) {

            let countryname  = i;
            let divname      = '#'+i;
            let ops_placed   = [];

              if (this.countries[i].region.indexOf("asia") != -1) {

              ops_placed[i] = 0;

              twilight_self.countries[countryname].place = 1;
              $(divname).off();
              $(divname).on('click', function() {
                let countryname = $(this).attr('id');
                if (twilight_self.countries[countryname].place == 1) {
                  ops_placed[countryname]++;
                  twilight_self.addMove("place\tus\tus\t"+countryname+"\t1");
                  twilight_self.placeInfluence(countryname, 1, "us", function() {
                    if (ops_placed[countryname] >= 2) {
                      twilight_self.countries[countryname].place = 0;
                    }
                    ops_to_place--;
                    if (ops_to_place == 0) {
                      twilight_self.playerFinishedPlacingInfluence();
                      twilight_self.endTurn();
                    }
                  });
                } else {
                  twilight_self.displayModal("you cannot place there...");
                }
              });
            }
          }
          return 0;
        }
      } else {

        this.updateLog("US gets the China Card (face up)");

        //
        // us gets china card face up
        //
        this.game.state.events.china_card = 0;

        if (this.game.player == 1) {
          for (let i = 0; i < this.game.deck[0].hand.length; i++) {
            if (this.game.deck[0].hand[i] == "china") {
              this.game.deck[0].hand.splice(i, 1);
            }
          }
        }
        if (this.game.player == 2) {
          if (! this.game.deck[0].hand.includes("china")) {
            this.game.deck[0].hand.push("china");
          }
        }

        return 1;
      }
    }





    /////////////////////
    // Vietnam Revolts //
    /////////////////////
    if (card == "vietnamrevolts") {
      this.game.state.events.vietnam_revolts = 1;
      this.placeInfluence("vietnam", 2, "ussr");
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR plays ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS triggers ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }




    if (card == "voiceofamerica") {

      var ops_to_purge = 4;
      var ops_removable = 0;

      for (var i in this.countries) { if (this.countries[i].ussr > 0) { ops_removable += this.countries[i].ussr; } }
      if (ops_to_purge > ops_removable) { ops_to_purge = ops_removable; }
      if (ops_to_purge <= 0) {
        return 1;
      }


      if (this.game.player == 1) { return 0; }
      if (this.game.player == 2) {

        this.updateStatus("<div class='status-message' id='status-message'>Remove 4 USSR influence from non-European countries (max 2 per country)</div>");

        var twilight_self = this;
        var ops_purged = {};

        twilight_self.playerFinishedPlacingInfluence();
        twilight_self.addMove("resolve\tvoiceofamerica");

        for (var i in this.countries) {

          let countryname  = i;
          ops_purged[countryname] = 0;
          let divname      = '#'+i;

          if (this.countries[i].region != "europe") {

            twilight_self.countries[countryname].place = 1;

            $(divname).off();
            $(divname).on('click', function() {

              let c = $(this).attr('id');

              if (twilight_self.countries[c].place != 1 || twilight_self.countries[c].ussr == 0) {
                twilight_self.displayModal("Invalid Country");
              } else {
                ops_purged[c]++;
                if (ops_purged[c] >= 2) {
                  twilight_self.countries[c].place = 0;
                }
                twilight_self.removeInfluence(c, 1, "ussr", function() {
                  twilight_self.addMove("remove\tus\tussr\t"+c+"\t1");
                  ops_to_purge--;
                  if (ops_to_purge == 0) {
                    twilight_self.playerFinishedPlacingInfluence();
                    twilight_self.endTurn();
                  }
                });
              }
            });

          }
        }
      }
      return 0;
    }




    if (card == "wargames") {

      if (this.game.state.defcon != 2) {
        this.updateLog("Wargames event cannot trigger as DEFCON is not at 2");
        return 1;
      }

      let twilight_self = this;
      if (!i_played_the_card){
        return 0;
      }

      let choicehtml = '<ul><li class="card" id="endgame">end the game</li><li class="card" id="cont">continue playing</li></ul>';

      this.updateStatusWithOptions(`${this.cardToText(card)}: Do you want to give your opponent 6 VP and End the Game? (VP ties will be won by opponent)`, choicehtml, false);
      

      twilight_self.attachCardboxEvents(function(action2) {

        if (action2 == "endgame") {
          twilight_self.updateStatus("<div class='status-message' id='status-message'>Triggering Wargames...</div>");
          twilight_self.addMove("resolve\twargames");
          twilight_self.addMove("wargames\t"+player+"\t1");
          twilight_self.endTurn();
        }
        if (action2 == "cont") {
          twilight_self.updateStatus("<div class='status-message' id='status-message'>Discarding Wargames...</div>");
          twilight_self.addMove("resolve\twargames");
          twilight_self.addMove("wargames\t"+player+"\t0");
          twilight_self.endTurn();
        }
      });

      return 0;
    }



    /////////////////
    // Warsaw Pact //
    /////////////////
    if (card == "warsawpact") {

      this.game.state.events.warsawpact = 1;

      if (this.game.player == 2) {
        //this.updateStatus(`<div class='status-message' id='status-message'>Waiting for USSR to play ${this.cardToText(card)}</div>`);
        return 0;
      }
      if (this.game.player == 1) {

        var twilight_self = this;
        twilight_self.playerFinishedPlacingInfluence();

        let html = `
          <ul>
            <li class="card" id="remove">remove all US influence in four countries in Eastern Europe</li>
            <li class="card" id="add">add five USSR influence in Eastern Europe (max 2 per country)</li>
          </ul>`;
        twilight_self.updateStatusWithOptions("USSR establishes the Warsaw Pact:",html,false);

        twilight_self.attachCardboxEvents(function(action2) {
          const europeanCountries = ["czechoslovakia", "austria", "hungary", "romania", "yugoslavia", "bulgaria", "eastgermany", "poland", "finland"];

          if (action2 == "remove") {

            twilight_self.addMove("resolve\twarsawpact");
            twilight_self.updateStatus('<div class="status-message" id="status-message">Remove all US influence from four countries in Eastern Europe</div>');

            var countries_to_purge = 4;
            var options_purge = [];

            for (var c of europeanCountries) {
              let divname      = '#'+c;
              
              if (twilight_self.countries[c].us > 0) { 
                options_purge.push(c); 
                $(divname).addClass("easterneurope");
                twilight_self.countries[c].place = 1;
              }

            }

            if (options_purge == 0){
              
              twilight_self.displayModal("US has no influence in Eastern Europe", "Add influence instead");
              action2 = "add";

            }else if (options_purge.length <= countries_to_purge) {

              for (let i = 0; i < options_purge.length; i++) {
                twilight_self.addMove("remove\tussr\tus\t"+options_purge[i]+"\t"+twilight_self.countries[options_purge[i]].us);
                twilight_self.removeInfluence(options_purge[i], twilight_self.countries[options_purge[i]].us, "us");
              }

              twilight_self.endTurn();
              twilight_self.updateStatus(`Only ${options_purge.length} countries in Eastern Europe with US influence...`);

            } else {

              var countries_purged = 0;

              $(".easterneurope").off();
              $(".easterneurope").on('click', function() {

                let c = $(this).attr('id');

                if (twilight_self.countries[c].place != 1) {
                  twilight_self.displayModal("Invalid Option", "No US influence to remove");
                } else {
                  twilight_self.countries[c].place = 0;
                  let uspur = twilight_self.countries[c].us;
                  twilight_self.removeInfluence(c, uspur, "us");
                  twilight_self.addMove("remove\tussr\tus\t"+c+"\t"+uspur);
                  countries_purged++;
                
                  if (countries_purged == countries_to_purge) {
                    twilight_self.playerFinishedPlacingInfluence();
                    twilight_self.endTurn();
                  }
                }
              });
            }
          }

          if (action2 == "add") {

            twilight_self.addMove("resolve\twarsawpact");
            twilight_self.updateStatus('<div class="status-message" id="status-message">Add five influence in Eastern Europe (max 2 per country)</div>');

            var ops_to_place = 5;
            var ops_placed = {};

            for (var c of europeanCountries) {

              ops_placed[c] = 0;
              let divname      = '#'+c;
              $(divname).addClass("easterneurope");
              twilight_self.countries[c].place = 1;

            }

            $(".easterneurope").off();
            $(".easterneurope").on('click', function() {

              let c = $(this).attr('id');

              if (twilight_self.countries[c].place != 1) {
                twilight_self.displayModal("Invalid Placement");
              } else {
                ops_placed[c]++;
                ops_to_place--;
                twilight_self.placeInfluence(c, 1, "ussr");
                twilight_self.addMove("place\tussr\tussr\t"+c+"\t1");
                
                if (ops_placed[c] >= 2) { twilight_self.countries[c].place = 0; }
                
                if (ops_to_place == 0) {
                  twilight_self.playerFinishedPlacingInfluence();
                  twilight_self.endTurn();
                }
              }
            });

          }
        });
        return 0;
      }

      return 1;
    }



    if (card == "willybrandt") {

      if (this.game.state.events.teardown == 1) {
        this.updateLog("Willy Brandt canceled by Tear Down this Wall");
        return 1;
      }

      this.game.state.vp -= 1;
      this.updateVictoryPoints();

      this.countries["westgermany"].ussr += 1;
      this.showInfluence("westgermany", "ussr");

      this.game.state.events.nato_westgermany = 0;
      this.game.state.events.willybrandt = 1;

      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR plays ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS triggers ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }





    //
    // We Will Bury You
    //
    if (card == "wwby") {

      this.game.state.events.wwby = 1;

      this.lowerDefcon(); //Checks for end game
      this.updateDefcon();

      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR plays ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS triggers ${this.cardToText(card)}.`);
        }
      }
      
      return 1;
    }









    //
    // Yuri and Samantha
    //
    if (card == "yuri") {
      this.game.state.events.yuri = 1;
      if (!i_played_the_card){
        if (player == "ussr"){
          this.game.queue.push(`ACKNOWLEDGE\tUSSR plays ${this.cardToText(card)}.`);
        }else{
          this.game.queue.push(`ACKNOWLEDGE\tUS triggers ${this.cardToText(card)}.`);
        }
      }
      return 1;
    }




    if (card == "berlinagreement") {

      this.game.state.events.optional.berlinagreement = 1;

      let twilight_self = this;

      let me = "ussr";
      let opponent = "us";
      if (this.game.player == 2) { opponent = "ussr"; me = "us"; }

      this.game.countries['eastgermany'].us += 2;
      this.game.countries['westgermany'].ussr += 2;

      this.showInfluence("eastgermany", "us");
      this.showInfluence("westgermany", "ussr");

      let ops_to_place = 1;
      let placeable = [];

      for (var i in twilight_self.countries) {
        let countryname  = i;
        let us_predominates = 0;
        let ussr_predominates = 0;
        if (this.countries[countryname].region == "europe") {
          if (this.countries[countryname].us > this.countries[countryname].ussr) { us_predominates = 1; }
          if (this.countries[countryname].us < this.countries[countryname].ussr) { ussr_predominates = 1; }
    if (player == "us" && us_predominates == 1) { placeable.push(countryname); }
    if (player == "ussr" && ussr_predominates == 1) { placeable.push(countryname); }
        }
      }

      if (placeable.length == 0) {
        this.updateLog(player + " cannot place 1 additional OP");
        return 1;
      } else {

        if (player == opponent) {
    this.updateStatus("<div class='status-message' id='status-message'>Opponent is placing 1 influence in a European country in which they have a predominance of influence</div>");
    return 0;

        }

        this.addMove("resolve\tberlinagreement");
        this.updateStatus("<div class='status-message' id='status-message'>Place 1 influence in a European country in which you have a predominance of influence</div>");

        for (let i = 0; i < placeable.length; i++) {

          let countryname = placeable[i];
          let divname = "#"+placeable[i];

          this.game.countries[placeable[i]].place = 1;

          $(divname).off();
          $(divname).on('click', function() {

            twilight_self.placeInfluence(countryname, 1, player, function() {
              twilight_self.addMove("place\t"+player+"\t"+player+"\t"+countryname+"\t1");
              twilight_self.playerFinishedPlacingInfluence();
              twilight_self.endTurn();
            });

    });

        }

      }

      return 0;
    }



    if (card == "culturaldiplomacy") {

      var twilight_self = this;
      twilight_self.playerFinishedPlacingInfluence();

      if ((player == "us" && this.game.player == 2) || (player == "ussr" && this.game.player == 1)) {

        twilight_self.addMove("resolve\tculturaldiplomacy");

        this.updateStatus("<div class='status-message' id='status-message'>Place one influence two hops away from a country in which you have existing influence. You cannot break control with this influence.</div>");

        for (var i in this.countries) {

          let countryname  = i;
          let divname      = '#'+i;

          $(divname).off();
          $(divname).on('click', function() {

            let is_this_two_hops = 0;
            let opponent_controlled = 0;
            let selected_countryname = $(this).attr('id');

            let neighbours = twilight_self.countries[selected_countryname].neighbours;
            for (let z = 0; z < neighbours.length; z++) {

              let this_country = twilight_self.countries[selected_countryname].neighbours[z];
              let neighbours2  = twilight_self.countries[this_country].neighbours;

              for (let zz = 0; zz < neighbours2.length; zz++) {
                let two_hopper = neighbours2[zz];
                if (player == "us") { if ( twilight_self.countries[two_hopper].us > 0) { is_this_two_hops = 1; } }
                if (player == "ussr") { if ( twilight_self.countries[two_hopper].ussr > 0) { is_this_two_hops = 1; } }
                if (is_this_two_hops == 1) { z = 100; zz = 100; }
              }
            }

	    if (player == "us") {
              if (twilight_self.isControlled("ussr", selected_countryname) == 1) { opponent_controlled = 1; }
	    }
	    if (player == "ussr") {
              if (twilight_self.isControlled("us", selected_countryname) == 1) { opponent_controlled = 1; }
	    }


            if (is_this_two_hops == 1 && opponent_controlled == 0) {
              twilight_self.addMove("place\t"+player+"\t"+player+"\t"+selected_countryname+"\t1");
              twilight_self.placeInfluence(selected_countryname, 1, player, function() {
                twilight_self.playerFinishedPlacingInfluence();
                twilight_self.endTurn();
              });
            } else {
              twilight_self.displayModal("Invalid Target");
            }
          });
        }
      } else {
        this.updateLog("Opponent is launching a soft-power tour");
      }

      return 0;
    }




    //
    // Gouzenko Affair -- credit https://www.reddit.com/user/ludichrisness/
    //
    if (card == "gouzenkoaffair") {
      this.updateLog("Canada now permanently adjacent to USSR");
      this.game.countries['canada'].ussr += 2;
      this.game.state.events.optional.gouzenkoaffair = 1;
      this.showInfluence("canada", "ussr");
      return 1;
    }



    if (card == "handshake") {
      if (player == "us") {
        this.updateLog("USSR advances in the Space Race...");
        this.game.state.space_race_ussr += 1;
        this.updateSpaceRace();
      } else {
        this.updateLog("US advances in the Space Race...");
        this.game.state.space_race_us += 1;
        this.updateSpaceRace();
      }
      return 1;
    }


    if (card == "poliovaccine") {

      let my_go = 0;
      if (player == "ussr" && this.game.player == 1) { my_go = 1; }
      if (player == "us" && this.game.player == 2) { my_go = 1; }

      if (my_go == 0) {
        this.updateStatus("<div class='status-message' id='status-message'>Waiting for Opponent to play Polio Vaccine</div>");
        return 0;

      }
      if (my_go == 1) {

        var twilight_self = this;
        let cards_discarded = 0;

        let cards_to_discard = 0;
        let html = "<ul>";
        for (let i = 0; i < this.game.deck[0].hand.length; i++) {
          if (this.game.deck[0].hand[i] != "china") {
            html += `<li class="card" id="${this.game.deck[0].hand[i]}">${this.game.deck[0].cards[this.game.deck[0].hand[i]].name}</li>`;
            cards_to_discard++;
          }
        }

        if (cards_to_discard == 0) {
          twilight_self.addMove("notify\tPlayer has no cards available to discard");
          twilight_self.endTurn();
          return 0;
        }

        html += '<li class="card dashed nocard" id="finished">finished</li></ul>';
        twilight_self.updateStatusWithOptions("Select cards to discard:",html,false);
        twilight_self.addMove("resolve\tpoliovaccine");

        twilight_self.attachCardboxEvents(function(card) {
          cards_discarded++;
          twilight_self.removeCardFromHand(action2);
          twilight_self.addMove("discard\tus\t"+action2);

          console.log(cards_discarded);

          if (action2 == "finished" || cards_discarded == 3) {

            //
            // if Aldrich Ames is active, US must reveal cards
            //
            if (this.game.player == 1) {
              twilight_self.addMove("DEAL\t1\t1\t"+cards_discarded);
            }
            if (this.game.player == 2) {
              twilight_self.addMove("DEAL\t1\t2\t"+cards_discarded);
            }

            //
            // are there enough cards available, if not, reshuffle
            //
            if (cards_discarded > twilight_self.game.deck[0].crypt.length) {

              let discarded_cards = twilight_self.returnDiscardedCards();
              if (Object.keys(discarded_cards).length > 0) {

                //
                // shuffle in discarded cards
                //
                twilight_self.addMove("SHUFFLE\t1");
                twilight_self.addMove("DECKRESTORE\t1");
                twilight_self.addMove("DECKENCRYPT\t1\t2");
                twilight_self.addMove("DECKENCRYPT\t1\t1");
                twilight_self.addMove("DECKXOR\t1\t2");
                twilight_self.addMove("DECKXOR\t1\t1");
                twilight_self.addMove("flush\tdiscards"); // opponent should know to flush discards as we have
                twilight_self.addMove("DECK\t1\t"+JSON.stringify(discarded_cards));
                twilight_self.addMove("DECKBACKUP\t1");
                twilight_self.updateLog("cards remaining: " + twilight_self.game.deck[0].crypt.length);
                twilight_self.updateLog("Shuffling discarded cards back into the deck...");

              }
            }
            twilight_self.endTurn();
          }
        });
      }

      return 0;
    }




  if (card == "rustinredsquare") {
      this.updateLog("DEFCON increases by 1");
      this.updateLog("USSR milops reset to 0");
      this.game.state.defcon++;
      this.game.state.milops_ussr = 0;
      this.updateDefcon();
      this.updateMilitaryOperations();
      return 1;
    }


    if (card == "breakthroughatlopnor") {

      //
      // flip china card or handle VP -- TODO
      //
      let who_has_the_china_card = this.whoHasTheChinaCard();
      for (let i = 0; i < this.game.deck[0].hand.length; i++) {
        if (this.game.deck[0].hand[i] == "china") {
          this.game.deck[0].hand.splice(i, 1);
        }
      }
      if (who_has_the_china_card == "us") {
        if (this.game.state.events.china_card_facedown == 1) {
          this.game.state.vp -= 1;
          this.updateLog("US loses 1 VP for Lop Nor");
          this.updateVictoryPoints();
        }
        this.game.state.events.china_card = 2;
        this.game.state.events.china_card_facedown = 1;
      } else {
        if (this.game.state.events.china_card_facedown == 1) {
          this.game.state.vp += 1;
          this.updateLog("USSR loses 1 VP for Lop Nor");
          this.updateVictoryPoints();
        }
        this.game.state.events.china_card = 1;
        this.game.state.events.china_card_facedown = 1;
      }
      this.displayChinaCard();

      var ops_to_purge = 3;
      var ops_removable = 0;

      for (var i in this.countries) { if (this.countries[i].us > 0) { ops_removable += this.countries[i].us; } }
      if (ops_to_purge > ops_removable) { ops_to_purge = ops_removable; }
      if (ops_to_purge <= 0) { return 1; }

      if (this.game.player == 2) { return 0; }
      if (this.game.player == 1) {

        this.updateStatus("<div class='status-message' id='status-message'>Remove 3 US influence from Southeast Asia or North Korea (max 2 per country)</div>");

        var twilight_self = this;
        var ops_purged = {};

        twilight_self.playerFinishedPlacingInfluence();
        twilight_self.addMove("resolve\tbreakthroughatlopnor");

        for (var i in this.countries) {

          let countryname  = i;
          ops_purged[countryname] = 0;
          let divname      = '#'+i;

          if (this.countries[i].region === "seasia" || i == "northkorea") {

            twilight_self.countries[countryname].place = 1;

            $(divname).off();
            $(divname).on('click', function() {

              let c = $(this).attr('id');

              if (twilight_self.countries[c].place != 1 || twilight_self.countries[c].us == 0) {
                twilight_self.displayModal("Invalid Country");
              } else {
                ops_purged[c]++;
                if (ops_purged[c] >= 2) {
                  twilight_self.countries[c].place = 0;
                }
                twilight_self.removeInfluence(c, 1, "us", function() {
                  twilight_self.addMove("remove\tussr\tus\t"+c+"\t1");
                  ops_to_purge--;
                  if (ops_to_purge == 0) {
                    twilight_self.playerFinishedPlacingInfluence();
                    twilight_self.endTurn();
                  }
                });
              }
            });

          }
        }
      }
      return 0;
    }



    if (card == "eurocommunism") {

      if (this.game.player == 1) {
        this.updateStatus("<div class='status-message' id='status-message'>Eurocommunism: US is removing 4 USSR influence from Western Europe (max 2 per country)</div>");
        return 0;

      }
      if (this.game.player == 2) {

        this.updateStatus("<div class='status-message' id='status-message'>Remove 4 USSR influence from Western Europe (max 2 per country)</div>");

        let twilight_self = this;
        twilight_self.playerFinishedPlacingInfluence();
        twilight_self.addMove("resolve\teurocommunism");

        let ops_to_purge = 4;
        let ops_purged = {};
        let available_targets = 0;

        for (var i in this.countries) {
          if (i == "italy" || i == "turkey" || i == "greece" || i == "spain" || i == "france" || i == "westgermany" || i == "uk" || i == "canada" || i == "benelux" || i == "finland" || i == "austria" || i == "denmark" || i == "norway" || i == "sweden") {
            if (twilight_self.countries[i].ussr == 1) { available_targets += 1; }
            if (twilight_self.countries[i].ussr > 1) { available_targets += 2; }
          }
        }
        if (available_targets == 0) {
          this.addMove("notify\tUSSR has no influence in Western Europe to remove");
          this.endTurn();
          return 0;
        }
        if (available_targets < 4) {
          ops_to_purge = available_targets;
          this.updateStatus("<div class='status-message' id='status-message'>Remove " + ops_to_purge + " USSR influence from Western Europe (max 2 per country)</div>");
        }


        for (var i in this.countries) {

          let countryname = i;
          ops_purged[countryname] = 0;
          let divname = '#' + i;

          if (i == "italy" || i == "turkey" || i == "greece" || i == "spain" || i == "france" || i == "westgermany" || i == "uk" || i == "canada" || i == "benelux" || i == "finland" || i == "austria" || i == "denmark" || i == "norway" || i == "sweden") {

            twilight_self.countries[countryname].place = 1;

            if (twilight_self.countries[countryname].ussr > 0) {

              $(divname).off();
              $(divname).on('click', function () {
                let c = $(this).attr('id');
                if (twilight_self.countries[c].place != 1) {
                  twilight_self.displayModal("Invalid Country");
                } else {
                  ops_purged[c]++;
                  if (ops_purged[c] >= 2) {
                    twilight_self.countries[c].place = 0;
                  }
                  twilight_self.removeInfluence(c, 1, "ussr", function () {
                    twilight_self.addMove("remove\tus\tussr\t" + c + "\t1");
                    ops_to_purge--;
                    if (ops_to_purge == 0) {
                      twilight_self.playerFinishedPlacingInfluence();
                      twilight_self.endTurn();
                    }
                  });
                }
              });
            }
          }
        }
        return 0;
      }
      return 0;
    }


    if (card == "greatsociety") {

      this.game.state.events.greatsociety = 1;

      return 1;
    }

    /*
      Both players -1 to all Coup Attempts for remainder of turn
      Ignore DEFCON for realignment
    */

    if (card == "inftreaty") {

      // update defcon
      this.game.state.defcon += 2;
      if (this.game.state.defcon > 5) { this.game.state.defcon = 5; }
      this.updateDefcon();

      // affect coups
      this.game.state.events.inftreaty = 1;

      let my_go = 0;
      if (player === "ussr" && this.game.player == 1) { my_go = 1; }
      if (player === "us" && this.game.player == 2) { my_go = 1; }
      if (my_go == 0) {
        this.updateStatus("<div class='status-message' id='status-message'>Opponent is playing INF Treaty</div>");
        return 0;
      }

      this.addMove("resolve\tinftreaty");
      this.addMove("unlimit\tcoups");
      this.addMove("ops\t"+player+"\tinftreaty\t3");
      this.addMove("limit\tcoups");
      this.addMove("notify\t"+player+" plays 3 OPS for influence or realignments");
      this.endTurn();

      return 0;
    }



    if (card == "manwhosavedtheworld") {
      this.game.state.events.manwhosavedtheworld = player;
      return 1;
    }


    if (card == "nationbuilding") {

      let twilight_self = this;
      let me = "ussr";
      let opponent = "us";
      if (this.game.player == 2) { opponent = "ussr"; me = "us"; }

      if (player != me) {
        this.updateStatus("<div class='status-message' id='status-message'>Opponent is playing Nation Building</div>");
        return 0;

      } else {

        this.addMove("resolve\tnationbuilding");

        let eligible_cards = [];

        for (let i = 0; i < this.game.deck[0].hand.length; i++) {
          if (me === "ussr" && this.game.deck[0].cards[this.game.deck[0].hand[i]].player === "ussr") { eligible_cards.push(this.game.deck[0].hand[i]); }
          if (me === "us" && this.game.deck[0].cards[this.game.deck[0].hand[i]].player === "us") { eligible_cards.push(this.game.deck[0].hand[i]); }
        }

        if (eligible_cards.length == 0) {
          this.playerFinishedPlacingInfluence();
          this.addMove("notify\t"+player.toUpperCase()+" has no valid cards for Nation Building");
          this.endTurn();
          return 0;
        }


        let eligible_countries = 0;
        this.updateStatus("<div class='status-message' id='status-message'>Select any country in Africa, Central America or South America that is not controlled by the opposing player and in which you have at least 1 influence: </div>");
        for (var i in this.countries) {

          let divname      = '#'+i;
          let is_eligible = 0;

          if (this.isControlled(opponent, i) != 1) {
            if (me == "ussr") { if (this.countries[i].ussr > 0) { is_eligible = 1; } }
            if (me == "us") { if (this.countries[i].us > 0) { is_eligible = 1; } }
          }

          if (is_eligible == 1) {

            eligible_countries++;

            $(divname).off();
            $(divname).on('click', function() {

              let c = $(this).attr("id");
              $('.country').off();

              let html = 'Discard one of the following cards to increase the stability of this country by 1 and add 1 influence: ';
              twilight_self.updateStatusAndListCards(html, eligible_cards);
              twilight_self.attachCardboxEvents(function(card) {
                twilight_self.placeInfluence(c, 1, player, function() {
                  twilight_self.removeCardFromHand(card);
                  twilight_self.addMove("place\t"+player+"\t"+player+"\t"+c+"\t1");
                  twilight_self.addMove("stability\t"+player+"\t"+c+"\t1");
                  twilight_self.addMove("discard\t"+player+"\t"+card);
                  twilight_self.addMove("notify\t"+player.toUpperCase()+" discards <span class=\"showcard\" id=\""+card+"\">"+twilight_self.game.deck[0].cards[card].name + "</span>");
                  twilight_self.endTurn(1);
                });
              });
            });

          } else {

            $(divname).off();
            $(divname).on('click', function() {
              alert("Invalid Option");
            });

          }
        }

        if (eligible_countries == 0) {

          this.playerFinishedPlacingInfluence();
          this.addMove("notify\t"+player.toUpperCase()+" has no eligible countries for Nation Building");
          this.endTurn();
          return 0;

        }
      }

      return 0;
    }


    if (card == "perestroika") {

      if (this.game.player == 2) {
        this.updateStatus("<div class='status-message' id='status-message'>USSR is playing Perestroika</div>");
        return 0;
      }
      if (this.game.player == 1) {

        var twilight_self = this;
        twilight_self.playerFinishedPlacingInfluence();

        twilight_self.addMove("resolve\tperestroika");

        twilight_self.updateStatusWithOptions('Remove four USSR influence from existing countries. You will receive 1 VP per influence removed from battleground countries, and 1 VP for every 2 influence removed from non-battleground countries controlled by the USSR:','<ul><li class="card" id="skip">or skip...</li></ul>');
        twilight_self.attachCardboxEvents(function(action2) {
          twilight_self.playerFinishedPlacingInfluence();
          twilight_self.endTurn();
        });

        let ops_to_purge = 4;
        let bginf = 0;
        let nonbginf = 0;

        for (var i in this.countries) {

          let countryname  = i;
          let divname      = '#'+i;

          $(divname).off();
          $(divname).on('click', function() {

            let c = $(this).attr('id');

            if (twilight_self.isControlled("ussr", c) != 1) {

              twilight_self.displayModal("Invalid Option");
              return;

            } else {

              if (twilight_self.countries[c].bg == 1) {
                twilight_self.removeInfluence(c, 1, "ussr");
                twilight_self.addMove("vp\tussr\t1")
                twilight_self.addMove("remove\tussr\tussr\t"+c+"\t1");
              } else {
                twilight_self.removeInfluence(c, 1, "ussr");
                nonbginf++;
                if (nonbginf == 2) {
                  twilight_self.addMove("vp\tussr\t1")
                  nonbginf = 0;
                }
                twilight_self.addMove("remove\tussr\tussr\t"+c+"\t1");
              }

              ops_to_purge--;
              if (ops_to_purge == 0) {
                twilight_self.playerFinishedPlacingInfluence();
                twilight_self.endTurn();
              }

            }
          });
        }
      }
      return 0;
    }


    if (card == "peronism") {

      let twilight_self = this;
      let me = "ussr";
      let opponent = "us";
      if (this.game.player == 2) { opponent = "ussr"; me = "us"; }

      this.placeInfluence("argentina", 1, "us");
      this.placeInfluence("argentina", 1, "ussr");

      if (player != me) {
        this.updateStatus("<div class='status-message' id='status-message'>Opponent deciding to add influence to or coup or realign Argentina</div>");
        return 0;

      } else {

        let html = `<ul>
                    <li class="card" id="place">place 1 influence in Argentina</li>
                    <li class="card" id="couporrealign">coup or realign Argentina</li>
                    </ul>`;

        this.updateStatusWithOptions("Do you choose to:",html,false);

        twilight_self.attachCardboxEvents(function(action2) {
          if (action2 == "place") {
            twilight_self.placeInfluence("argentina", 1, player, function() {
              twilight_self.addMove("resolve\tperonism");
              twilight_self.addMove("place\t"+player+"\t"+player+"\targentina\t1");
              twilight_self.addMove("notify\t"+player+" places an extra influence in Argentina");
              twilight_self.endTurn();
            });

          }
          if (action2 == "couporrealign") {
            let user_message = "Do you choose to:";
            html = `<ul>
                    <li class="card" id="coup">coup in Argentina</li>
                    <li class="card" id="realign">realign in Argentina</li>
                    </ul>`;

            twilight_self.updateStatusWithOptions(user_message,html,false);
            twilight_self.attachCardboxEvents(function(action2) {

              let modified_ops = twilight_self.modifyOps(1, "peronism", me);

              if (action2 == "coup") {
                twilight_self.addMove("resolve\tperonism");
                twilight_self.addMove("coup\t"+player+"\targentina\t"+modified_ops+"\tperonism");
                twilight_self.endTurn();
              }
              if (action2 == "realign") {
                twilight_self.addMove("resolve\tperonism");
                let result = twilight_self.playRealign("argentina");
                modified_ops--;
                if (modified_ops > 0) {
                  user_message = "You have an OP Bonus. Realign again?:";
                  html = `<ul>
                          <li class="card" id="realign">realign in Argentina</li>
                          <li class="card" id="skip">no, please stop</li>
                          </ul>`;
                  //Is there a bug here?? 

                  let action2 = $(this).attr("id");
                  if (action2 == "realign") {
                    let result2 = twilight_self.playRealign("argentina");
                    twilight_self.addMove("realign\t"+player+"\targentina");
                    twilight_self.addMove("realign\t"+player+"\targentina");
                  }
                  if (action2 == "skip") {
                    twilight_self.addMove("realign\t"+player+"\targentina");
                    twilight_self.endTurn();
                  }

                } else {
                  twilight_self.addMove("realign\t"+player+"\targentina");
                  twilight_self.endTurn();
                }

                twilight_self.playerFinishedPlacingInfluence();
                twilight_self.endTurn();
              }
            });
          }
        });
      }

      return 0;
    }


    if (card == "berlinairlift") {

      let me = "ussr";
      let opponent = "us";
      if (this.game.player == 2) { opponent = "ussr"; me = "us"; }

      this.game.state.events.berlinairlift = 1;

      return 0;
    }



    if (card == "communistrevolution") {

      let me = "ussr";
      let opponent = "us";
      if (this.game.player == 2) { opponent = "ussr"; me = "us"; }

      this.game.state.events.communistrevolution = 1;

console.log("communistrevolution ! " + me + " -- " + player);

      if (me == "us") {
        let burned = this.rollDice(6);
	return 0;
      }
      if (me == "ussr") {

        var twilight_self = this;
        twilight_self.playerFinishedPlacingInfluence();

        twilight_self.addMove("resolve\tcommunistrevolution");
        twilight_self.updateStatus('<div class="status-message" id="status-message">Pick target for Communist Revolution</div>');

        for (var i in twilight_self.countries) {

          let divname = "#" + i;

          $(divname).off();
          $(divname).on('click', function() {

	    $(divname).off();
            let c = $(this).attr('id');

console.log("picked: " + c);
console.log(twilight_self.countries[c]);
            let dieroll = twilight_self.rollDice(6);
            let stability = twilight_self.countries[c].control;
            let modified_stability = stability;
            for (let i = 0; i < stability; i++) {
	      if (i > 0 && i%2 == 1) {
		modified_stability--;
	      }
	    }

	    twilight_self.addMove("SETVAR\tcountries\t"+c+"\t"+"control"+"\t"+stability);
	    twilight_self.addMove("SETVAR\tstate\tlimit_ignoredefcon\t"+0);
	    twilight_self.addMove("SETVAR\tstate\tlower_defcon_on_coup\t"+1);
	    twilight_self.addMove("coup\tussr\t"+c+"\t"+twilight_self.modifyOps(2));
	    twilight_self.addMove("SETVAR\tstate\tlower_defcon_on_coup\t"+0);
	    twilight_self.addMove("SETVAR\tstate\tlimit_ignoredefcon\t"+1);
	    twilight_self.addMove("SETVAR\tcountries\t"+c+"\t"+"control"+"\t"+modified_stability);
	    twilight_self.endTurn();

          });
        }
      }

      return 0;
    }



    if (card == "philadelphia") {

      let me = "ussr";
      let opponent = "us";
      if (this.game.player == 2) { opponent = "ussr"; me = "us"; }

      if (me == "ussr") {
	return 0;
      }
      if (me == "us") {

        var twilight_self = this;
        twilight_self.playerFinishedPlacingInfluence();

        twilight_self.addMove("resolve\tphiladelphia");
        twilight_self.updateStatus('<div class="status-message" id="status-message">Pick country to remove all US influence:</div>');

        for (var i in twilight_self.countries) {

          let divname = "#" + i;

          $(divname).off();
          $(divname).on('click', function() {

	    $(divname).off();
            let c = $(this).attr('id');

	    let us_country = c;
	    let us_influence = twilight_self.countries[c].us;
	    if (us_influence <= 0) { alert("Invalid Choice - country must have US influence"); return; }
	    twilight_self.removeInfluence(c, us_influence, "us");

            twilight_self.updateStatus('<div class="status-message" id="status-message">Place '+us_influence+' in any country not controlled by the USSR:</div>');
            for (var i in twilight_self.countries) {

	      if (twilight_self.isControlled("ussr", i) == 1) {} else {
                let divname = "#" + i;
                $(divname).off();
                $(divname).on('click', function() {
	          $(divname).off();
                  let c = $(this).attr('id');
	          twilight_self.placeInfluence(c, us_influence, "us");
	          twilight_self.addMove("place\tus\tus\t"+c+"\t"+us_influence);
	          twilight_self.addMove("remove\tus\tus\t"+us_country+"\t"+us_influence);
	          twilight_self.endTurn();
	        });
	      }
	    }
          });
        }
      }

      return 0;
    }



    /////////////////////
    // Sino-Indian War //
    /////////////////////
    if (card == "sinoindian") {

      let twilight_self = this;
      let me = "ussr";
      let opponent = "us";
      if (this.game.player == 2) { opponent = "ussr"; me = "us"; }

      if (twilight_self.whoHasTheChinaCard() != player) {
	twilight_self.updateLog("Sino-Indian War cannot trigger, as player does not have the China Card");
	return 1;
      }

      if (me != player) {
        let burned = this.rollDice(6);
        return 0;
      }
      if (me == player) {

	let target = 4;

        if (twilight_self.isControlled(opponent, "pakistan") == 1) { target++; }
        if (twilight_self.isControlled(opponent, "burma") == 1) { target++; }
	target--; // control of China Card

        let die = twilight_self.rollDice(6);
        twilight_self.addMove("notify\t"+player.toUpperCase()+" rolls "+die);

        if (die >= target) {

          if (player == "us") {
                twilight_self.addMove("place\tus\tus\tindia\t"+twilight_self.countries['india'].ussr);
                twilight_self.addMove("remove\tus\tussr\tindia\t"+twilight_self.countries['india'].ussr);
                twilight_self.addMove("milops\tus\t2");
                twilight_self.addMove("vp\tus\t3");
                twilight_self.placeInfluence("india", twilight_self.countries['india'].ussr, "us");
                twilight_self.removeInfluence("india", twilight_self.countries['india'].ussr, "ussr");
                twilight_self.endTurn();
                twilight_self.showInfluence("india", "ussr");
          } else {
                twilight_self.addMove("place\tussr\tussr\tindia\t"+twilight_self.countries['india'].us);
                twilight_self.addMove("remove\tussr\tus\tindia\t"+twilight_self.countries['india'].us);
                twilight_self.addMove("milops\tussr\t2");
                twilight_self.addMove("vp\tussr\t3");
                twilight_self.placeInfluence("india", twilight_self.countries['india'].us, "ussr");
                twilight_self.removeInfluence("india", twilight_self.countries['india'].us, "us");
                twilight_self.endTurn();
                twilight_self.showInfluence("india", "ussr");
          }

        } else {

          if (player == "us") {
                twilight_self.addMove("milops\tus\t2");
                twilight_self.endTurn();
          } else {
                twilight_self.addMove("milops\tussr\t2");
                twilight_self.endTurn();
          }
        }

      }
      return 0;
    }




    if (card == "sovietcoup") {

      let twilight_self = this;

      //if (this.game.state.events.reformer == 1 && this.game.state.round == 10) {
      if (1) {

console.log("ROUND: " + this.game.state.round);

	if (player == "us") {
	  let burn = twilight_self.rollDice(6);
	  return 0;
	}
	
        twilight_self.addMove("resolve\tsovietcoup");
        twilight_self.updateStatusWithOptions('Sacrifice any VP before rolling for +1 modifier:','<ul><li class="card" id="zero">0 VP</li><li class="card" id="one">1 VP</li><li class="card" id="two">2 VP</li><li class="card" id="three">3 VP</li></ul>');
        twilight_self.attachCardboxEvents(function(action) {

	  let modifier = 0;

          if (action === "one")   { modifier = 1; }
          if (action === "two")   { modifier = 2; }
          if (action === "three") { modifier = 3; }
	  if (modifier > 0) { twilight_self.addMove("vp\tus\t"+modifier); }

	  let roll = twilight_self.rollDice(6);
	  roll += modifier;

	  if (roll < 4) {
	    twilight_self.addMove("vp\tus\t10000");
	    twilight_self.addMove("NOTIFY\tUSSR rolls "+roll+" for Soviet Coup and loses the game.");
	    twilight_self.endTurn();
	    return;
	  }

	  let x = 0;

          x = twilight_self.countries['czechoslovakia'].us;
          twilight_self.removeInfluence("us", "czechoslovakia", x);
	  twilight_self.addMove("remove\tus\tczechoslovakia\t"+x);

          x = twilight_self.countries['austria'].us;
          twilight_self.removeInfluence("us", "austria", x);
	  twilight_self.addMove("remove\tus\taustria\t"+x);

          x = twilight_self.countries['hungary'].us;
          twilight_self.removeInfluence("us", "hungary", x);
	  twilight_self.addMove("remove\tus\thungary\t"+x);

          x = twilight_self.countries['romania'].us;
          twilight_self.removeInfluence("us", "romania", x);
	  twilight_self.addMove("remove\tus\tromania\t"+x);

          x = twilight_self.countries['yugoslavia'].us;
          twilight_self.removeInfluence("us", "yugoslavia", x);
	  twilight_self.addMove("remove\tus\tyugoslavia\t"+x);

          x = twilight_self.countries['bulgaria'].us;
          twilight_self.removeInfluence("us", "bulgaria", x);
	  twilight_self.addMove("remove\tus\tbulgaria\t"+x);

          x = twilight_self.countries['eastgermany'].us;
          twilight_self.removeInfluence("us", "eastgermany", x);
	  twilight_self.addMove("remove\tus\teastgermany\t"+x);

          x = twilight_self.countries['poland'].us;
          twilight_self.removeInfluence("us", "poland", x);
	  twilight_self.addMove("remove\tus\tpoland\t"+x);

          x = twilight_self.countries['finland'].us;
          twilight_self.removeInfluence("us", "finland", x);
	  twilight_self.addMove("remove\tus\tfinland\t"+x);

          this.updateStatus("<div class='status-message' id='status-message'>Place eight influence in non-US controlled countries:</div>");
	  let influence_remaining = 8;

          for (var i in this.countries) {

            let countryname  = i;
            let divname      = '#'+i;

            if (twilight_self.isControlled("us", countryname) == 0) {
 
              $(divname).off();
              $(divname).on('click', function() {

                let countryname = $(this).attr('id');

                twilight_self.addMove("place\tussr\tussr\t"+countryname+"\t1");
                twilight_self.placeInfluence(countryname, 1, "ussr", function() {
		  influence_remaining--;
                  if (influence_remaining <= 0) {
                    twilight_self.playerFinishedPlacingInfluence();
                    twilight_self.endTurn();
                  }
                });
              });
            }
          }
        });
      } else {
	twilight_self.updateLog("Conditions for Soviet Coup are not met...");
        return 1;
      }

      return 1;
    }




    if (card == "sovietcoup") {

      let twilight_self = this;

      let x = twilight_self.countries['yugoslavia'].ussr;
      twilight_self.removeInfluence("ussr", "yugoslavia", x);
      twilight_self.placeInfluence("us", "yugoslavia", 1);
      twilight_self.countries['yugoslavia'].bg = 1;
      twilight_self.game.countries['yugoslavia'].bg = 1;

      return 1;

    }	



    if (card == "brexit") {

      let player_to_go = 1;
      if (player == "us") { player_to_go = 2; }

      if (this.game.state.round != 8) {
        this.updateLog("It is now round 8... again");
      }

      this.updateLog("25 VP now needed to win");
      this.updateLog("Wargames now requires "+this.game.state.wargames_concession+" VP concession.");

      this.game.vp_needed = 25;
      this.game.state.round = 8;
      this.game.state.wargames_concession += 2;

      return 1;
    }



    if (card == "kissingerisawarcriminal") {

      if (this.game.player == 1) {
        this.updateStatus("<div class='status-message' id='status-message'>US is playing Kissinger:</div>");
        return 0;

      }

      let user_message = "Designate a region to turn all 1-stability countries into battleground countries:";
      let html = `<ul>";
                  <li class="card" id="asia">Asia</li>
                  <li class="card" id="europe">Europe</li>
                  <li class="card" id="africa">Africa</li>
                  <li class="card" id="camerica">Central America</li>
                  <li class="card" id="samerica">South America</li>
                  <li class="card" id="mideast">Middle-East</li>
                  </ul>`;

      this.updateStatusWithOptions(user_message, html, false);

      let twilight_self = this;
      twilight_self.attachCardboxEvents(function(action2) {

	let selreg = "europe";
	if (action2 == "asia") { selreg = "Asia"; }
	if (action2 == "africa") { selreg = "Africa"; }
	if (action2 == "camerica") { selreg = "Central America"; }
	if (action2 == "samerica") { selreg = "South America"; }
	if (action2 == "mideast") { selreg = "Middle East"; }

        twilight_self.addMove("resolve\tkissingerisawarcriminal");

	for (let i in twilight_self.countries) {
	  if (twilight_self.countries[i].region.indexOf(action2) != -1 && twilight_self.countries[i].control == 1) {
            twilight_self.addMove("SETVAR\tcountries\t"+i+"\tbg\t"+1);
            twilight_self.addMove("notify\t"+twilight_self.countries[i].name + " is now a battleground country");
	  }
	}

        twilight_self.endTurn();

      });

      return 0;
    }





    //
    // return 0 so other cards do not trigger infinite loop
    //
    return 0;
  }






  //
  // arcade uses
  //
  returnShortGameOptionsArray(options) {

    let sgo = super.returnShortGameOptionsArray(options);
    let nsgo = [];

    for (let i in sgo) {
      let output_me = 1;
      if (output_me == 1) {
        nsgo[i] = sgo[i];
      }
    }

    return nsgo;
  }



} // end Twilight class

module.exports = Twilight;



