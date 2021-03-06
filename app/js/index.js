const { ipcRenderer } = require('electron');
const Mustache = require('mustache');
const anime = require('animejs');

let gamesData = ipcRenderer.sendSync('load-games-data');
let currentGameIndex = 0;
const posGameX = (gamesData.screen_width - 900) / 2;

let loading = {};
let inGame = false;

/* Gamepad support. Tested only on Xbox 360 controllers. */

// use: http://html5gamepad.com/ to test and determine your controller ids

let GamepadController = require('gamepadcontroller');
const gamepad1 = new GamepadController(0);

gamepad1.onButtonRelease(gamesData.select_button_id, (e) => {
    if (inGame) {
        return;
    }
    console.log('Select BTN');
    ChooseGame();
});
gamepad1.onButtonRelease(gamesData.exit_button_id, (e) => {
    if (inGame) {
        return;
    }
    console.log('Exit BTN');
    window.close();
});
// movement on left btn
gamepad1.onButtonRelease(gamesData.left_button_id, (e) => {
    if (inGame) {
        return;
    }
    console.log("esq");
    ChangeCurrentGameIndex(-1);
});
// movement on right btn
gamepad1.onButtonRelease(gamesData.right_button_id, (e) => {
    if (inGame) {
        return;
    }
    console.log("dir");
    ChangeCurrentGameIndex(1);
});
// movement on left stick
gamepad1.onStickMove(gamesData.stick_index, (state) => {
    if (inGame) {
        return;
    }

    if (state.current.x < 0.09 && state.current.x > -0.09) {
        return;
    }

    if (state.current.x > 0.1) {
        if (state.previous.x <= 0.1) {
            console.log("dir");
            ChangeCurrentGameIndex(1);
            return;
        }
    }

    if (state.current.x < -0.1) {
        if (state.previous.x >= -0.1) {
            console.log("esq");
            ChangeCurrentGameIndex(-1);
            return;
        }
    }
});

// when DOM is finally loaded
document.addEventListener("DOMContentLoaded", function (event) {
    // sets up the audio file conncetions
    document.querySelector("#audio_change").setAttribute("src", gamesData.sfx_change_game);
    document.querySelector("#audio_start").setAttribute("src", gamesData.sfx_start_game);
    document.querySelector("#audio_music").setAttribute("src", gamesData.music_menu);
    document.querySelector("#audio_change").load();
    document.querySelector("#audio_start").load();
    document.querySelector("#audio_music").load();
    PlaySound("#audio_music", true);

    document.querySelector('#arcade_name').textContent = gamesData.arcade_name;

    //console.log(navigator.getGamepads());
    document.querySelector('#loading').setAttribute("style", "width: " + gamesData.screen_width +
        "px; line-height: " + gamesData.screen_height +
        "px; height: " + gamesData.screen_height + "px;");

    anime({
        targets: '#loading',
        translateY: [0, (gamesData.screen_height + 500)],
        delay: 500,
        duration: 1000,
        easing: 'easeOutCubic'
    });

    // prepare the Bg and HTML markup for each game
    document.querySelector('body').setAttribute("style", "background-image: url(" + gamesData.bg_url +
        "); background-color: " + gamesData.bg_color + ";");
    let games = Mustache.render(
        "{{#games}}" +
        "<div class='game' id='{{id}}'>" +
        " <img class='game_cover' src='{{cover_path}}'>" +
        " <h2 class='game_name'>{{name}}</h2>" +
        " <p class='game_info' > {{info}}</p>" +
        " <p class='start'>play</p>" +
        "</div>" +
        "{{/games}}",
        gamesData);

    // move each game's info to their proper starting position
    document.querySelector('#all_games').innerHTML = games;
    document.querySelector('#all_games').setAttribute("style", "margin-top:" + ((gamesData.screen_height - 550) / 2 - 20) + "px;");

    var allGameElements = document.querySelectorAll('div.game');
    for (let i = 0; i < allGameElements.length; i++) {
        let element = allGameElements[i];
        element.setAttribute("style", "left: 9999px;");
        if (i == 0) {
            element.setAttribute("style", "left:" + posGameX + "px;");
        }
    }

    document.querySelector('.start').addEventListener('click', () => {
        if (inGame) {
            return;
        }
        // send a message to the main process
        ChooseGame();
    });

    document.querySelector('#btn_left').addEventListener('click', () => {
        if (inGame) {
            return;
        }
        ChangeCurrentGameIndex(-1);
    });

    document.querySelector('#btn_right').addEventListener('click', () => {
        if (inGame) {
            return;
        }
        ChangeCurrentGameIndex(1);
    });

    // handle keyboard changes, mostly for debug comfort
    document.addEventListener('keydown', (event) => {
        if (inGame) {
            event.preventDefault();
            return;
        }
        //document.querySelector('#game_start').textContent = event.key;
        switch (event.key) {
            case 'ArrowLeft':
                ChangeCurrentGameIndex(-1);
                break;
            case 'ArrowRight':
                ChangeCurrentGameIndex(1);
                break;
            case 'Enter':
                ChooseGame();
                break;
            case 'Escape':
                window.close();
                break;
            default:
                break;
        }
    });

    // after a game finishes, unblock inputs
    ipcRenderer.on('game-finished', () => {
        PlaySound("#audio_music", true);
        inGame = false;
        console.log("back to menu " + inGame);
        anime({
            targets: '#loading',
            translateY: [0, (gamesData.screen_height + 500)],
            delay: 500,
            duration: 1000,
            easing: 'easeOutCubic'
        });
    });
});

function ChooseGame() {
    // pause music
    document.querySelector("#audio_music").pause();
    // play SFX
    PlaySound("#audio_start", false);
    // this is used to block inputs
    inGame = true;
    // send a message to the main process when loading appears
    anime({
        targets: '#loading',
        translateY: [(gamesData.screen_height + 500), 0],
        duration: 1000,
        easing: 'easeOutCubic',
        complete: () => {
            ipcRenderer.send('start-game', currentGameIndex); // prints "pong"
        }
    });


}

function ChangeCurrentGameIndex(indexMod) {
    if (gamesData.games.lenght <= 1) {
        return;
    }
    let old = currentGameIndex;
    currentGameIndex += indexMod;
    if (currentGameIndex < 0) {
        currentGameIndex = gamesData.games.length - 1;
    }
    else if (currentGameIndex >= gamesData.games.length) {
        currentGameIndex = 0;
    }
    ChangeInfoOnDisplay(old, currentGameIndex, indexMod);
}

function PlaySound(id, loop) {
    document.querySelector(id).loop = loop;
    document.querySelector(id).play();
}

function ChangeInfoOnDisplay(oldIndex, newIndex, direction) {
    // play SFX
    PlaySound("#audio_change", false);
    let oldElement = document.querySelector('#' + gamesData.games[oldIndex].id);
    let newElement = document.querySelector('#' + gamesData.games[newIndex].id);

    let finalOld = -gamesData.screen_width,
        initNew = gamesData.screen_width;

    if (direction > 0) {
        finalOld = gamesData.screen_width;
        initNew = -gamesData.screen_width;
    }

    anime({
        targets: oldElement,
        left: [posGameX, finalOld],
        duration: 700,
        easing: 'easeInOutBack'
    });

    anime({
        targets: newElement,
        left: [initNew, posGameX],
        delay: 100,
        duration: 700,
        easing: 'easeInOutBack'
    });

    anime({
        targets: '.game_name',
        translateX: [60, 0],
        duration: 3500
    });

    anime({
        targets: '.game_info',
        translateX: [80, 0],
        duration: 3000
    });

    anime({
        targets: '.start',
        translateX: [40, 0],
        duration: 3200
    });
}
