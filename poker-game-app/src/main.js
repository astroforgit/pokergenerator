class StripPokerGame {
    constructor() {
        this.playerPot = 100;
        this.opponentPot = 100;
        this.playerBet = 0;
        this.opponentBet = 0;
        this.currentBet = 0;
        this.round = 1;
        this.ante = 5;
        this.totalPot = 0;
        this.playerHand = [];
        this.opponentHand = [];
        this.deck = [];
        this.currentOpponent = 0;
        this.gamePhase = 'start'; // betting1, drawing, betting2, showdown
        this.selectedCards = new Set(); // indices of cards to discard
        this.messageHistory = [];
        this.starter = 'player'; // Player starts the first round of the match

        // Add styles for selected cards
        const style = document.createElement('style');
        style.innerHTML = `
            .card.selected {
                transform: translateY(-15px);
                box-shadow: 0 0 10px #FFEB3B;
                border-color: #FFEB3B;
            }
            .draw-controls {
                display: none;
                gap: 10px;
                justify-content: center;
                margin-top: 10px;
            }
            .draw-controls.visible {
                display: flex;
            }
        `;
        document.head.appendChild(style);
        
        // Opponent data extracted from Atari BASIC
        this.opponents = [
            {
                name: 'Suzy',
                avatar: '👩',
                dialogue: this.getDialogueSet1(),
                clothing: ['top', 'pants', 'undies']
            },
            {
                name: 'Melissa', 
                avatar: '👱‍♀️',
                dialogue: this.getDialogueSet2(),
                clothing: ['top', 'pants', 'undies']
            }
        ];
        
        this.init();
    }

    getDialogueSet1() {
        return [
            "I'M ON A LUCKY STREAK NOW!",
            "TONIGHT'S MY LUCKY NIGHT.",
            "YOU BET ON THAT HAND?",
            "I WIN...I WIN...I WIN AGAIN!!!",
            "I'M NOT BAD FOR A BEGINNER!",
            "THIS IS GOING TO BE FUN!",
            "SAY, ANY REAL PLAYERS AROUND?",
            "I OWN THE CARDS TONIGHT, HONEY",
            "I'M TAKING CANDY FROM A BABY!",
            "DID YOU THINK I WAS BLUFFING?",
            "IS IT GETTING COLD OUT THERE?",
            "NOTHING UP MY SLEEVES...",
            "WERE YOU CHASING A RAINBOW???",
            "READ 'EM AND WEEP HONEY!",
            "YOUR LUCK HAS TO RUN OUT...",
            "YOU LUCKY *!#%&*+$#!@",
            "WIPE THAT GRIN OFF YOUR FACE!",
            "STOP WINNING, I'M GETTING COLD",
            "HEY! ENOUGH IS ENOUGH ALREADY!",
            "SO YOU'VE NEVER PLAYED BEFORE?",
            "LUCKY...LUCKY...LUCKY...",
            "NEXT DEAL...I CUT THE CARDS.",
            "BRRR...I FEEL A DRAFT.",
            "YOUR MOM WEARS ARMY BOOTS...",
            "SHIT!",
            "I HOPE YOUR GLASSES STEAM UP!",
            "PLEASE! PLEASE! PUSH RESET!!!",
            "WHO DEALT THESE CRUMMY CARDS?",
            "ARE YOU PEEKING AT MY CARDS?"
        ];
    }

    getDialogueSet2() {
        return [
            "I'M ON A LUCKY STREAK NOW!",
            "GIVE UP?",
            "OHHH...I LIKE A MAN WITH GUTS!",
            "HAVE YOU EVER HEARD OF ODDS?",
            "LOOK OUT! I'M WARMING UP!",
            "THIS IS GOING TO BE FUN!",
            "THIS ISN'T OLD MAID YOU KNOW.",
            "I'M GONNA HANG YOU OUT TO DRY!",
            "YOU TWERP!",
            "DID YOU THINK I WAS BLUFFING?",
            "IS IT GETTING COLD OUT THERE?",
            "I LOVE BEING DEALER.",
            "WHAT HAVE YOU BEEN SMOKING?",
            "NOW..NOW..GROWN MEN DON'T CRY.",
            "READ 'EM AND WEEP HONEY!!!",
            "ARE YOU MARKING THE CARDS?",
            "YOU LUCKY #^*#!@&%*#$!",
            "WIPE THAT GRIN OFF YOUR FACE!",
            "CUT IT OUT, I'M GETTING COLD!",
            "I REALLY HATE THIS GAME!!!",
            "SO YOU'VE NEVER PLAYED BEFORE?",
            "LUCKY...LUCKY...LUCKY...",
            "NEXT DEAL...I CUT THE CARDS.",
            "I'M NOT LIKING THIS...",
            "THESE CARDS REALLY STINK!",
            "NUTS...",
            "A BAD TRANSISTOR MADE ME BET!",
            "IT'S A GAME! STOP DROOLING!!!",
            "WHO DEALT THESE CRUMMY CARDS?",
            "ICK...I'M GETTING GOOSEBUMPS."
        ];
    }

    init() {
        // Inject Draw Controls into the DOM if not present
        if (!document.querySelector('.draw-controls')) {
            const bettingArea = document.querySelector('.betting-area');
            const drawDiv = document.createElement('div');
            drawDiv.className = 'draw-controls';
            drawDiv.innerHTML = `
                <button class="bet-btn stay-btn" onclick="game.drawCards()">DRAW</button>
            `;
            bettingArea.appendChild(drawDiv);
        }
        
        this.updateDisplay();
        this.newRound();
    }

    createDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        const deck = [];
        
        for (let suit of suits) {
            for (let rank of ranks) {
                deck.push({ suit, rank, value: this.getCardValue(rank) });
            }
        }
        
        return this.shuffleDeck(deck);
    }

    getCardValue(rank) {
        const values = {
            '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
            '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
        };
        return values[rank];
    }

    shuffleDeck(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    evaluateHand(hand) {
        const values = hand.map(card => card.value).sort((a, b) => b - a);
        const suits = hand.map(card => card.suit);
        
        const isFlush = suits.every(suit => suit === suits[0]);
        const isStraight = this.isStraight(values);
        
        const valueCounts = {};
        values.forEach(value => {
            valueCounts[value] = (valueCounts[value] || 0) + 1;
        });
        
        const counts = Object.values(valueCounts).sort((a, b) => b - a);
        
        if (isStraight && isFlush && values[0] === 14) return { rank: 9, name: 'Royal Flush', value: 900 };
        if (isStraight && isFlush) return { rank: 8, name: 'Straight Flush', value: 800 + values[0] };
        if (counts[0] === 4) return { rank: 7, name: 'Four of a Kind', value: 700 + parseInt(Object.keys(valueCounts).find(key => valueCounts[key] === 4)) };
        if (counts[0] === 3 && counts[1] === 2) return { rank: 6, name: 'Full House', value: 600 };
        if (isFlush) return { rank: 5, name: 'Flush', value: 500 + values[0] };
        if (isStraight) return { rank: 4, name: 'Straight', value: 400 + values[0] };
        if (counts[0] === 3) return { rank: 3, name: 'Three of a Kind', value: 300 + parseInt(Object.keys(valueCounts).find(key => valueCounts[key] === 3)) };
        if (counts[0] === 2 && counts[1] === 2) return { rank: 2, name: 'Two Pair', value: 200 };
        if (counts[0] === 2) return { rank: 1, name: 'One Pair', value: 100 + parseInt(Object.keys(valueCounts).find(key => valueCounts[key] === 2)) };
        
        return { rank: 0, name: 'High Card', highCard: values[0], value: values[0] };
    }

    isStraight(values) {
        if (values.includes(14) && values.includes(2) && values.includes(3) && values.includes(4) && values.includes(5)) {
             const uniqueValues = [...new Set(values)];
             if (uniqueValues.length === 5 && uniqueValues[0] === 14 && uniqueValues[1] === 5) return true;
        }

        for (let i = 0; i < values.length - 1; i++) {
            if (values[i] - 1 !== values[i + 1]) return false;
        }
        return true;
    }

    newRound() {
        this.round++;
        this.deck = this.createDeck();
        this.playerHand = this.deck.splice(0, 5);
        this.opponentHand = this.deck.splice(0, 5);
        
        // Toggle starter every round
        this.starter = (this.starter === 'player') ? 'opponent' : 'player';
        
        this.playerBet = this.ante;
        this.opponentBet = this.ante;
        this.playerPot -= this.ante;
        this.opponentPot -= this.ante;
        this.totalPot = this.playerBet + this.opponentBet;
        this.currentBet = this.ante;
        this.selectedCards.clear();
        
        this.gamePhase = 'betting1';
        this.updateDisplay();
        
        const introMsg = this.starter === 'player' ? "ANTE UP! Your move." : "ANTE UP! I'll start.";
        this.showDialogue(introMsg, false);
        
        this.updateButtons();
        
        if (this.starter === 'opponent') {
            setTimeout(() => this.opponentAction(), 1500);
        }
    }

    toggleCardSelection(index) {
        if (this.gamePhase !== 'drawing') return;
        
        if (this.selectedCards.has(index)) {
            this.selectedCards.delete(index);
        } else {
            this.selectedCards.add(index);
        }
        this.updateDisplay();
    }

    drawCards() {
        if (this.gamePhase !== 'drawing') return;
        
        const indices = Array.from(this.selectedCards).sort((a, b) => b - a);
        
        if (indices.length === 0) {
            this.showDialogue("You stand pat.", false);
        } else {
            indices.forEach(index => {
                this.playerHand.splice(index, 1);
            });
            
            const newCardsCount = indices.length;
            const newCards = this.deck.splice(0, newCardsCount);
            this.playerHand.push(...newCards);
            
            this.showDialogue(`You drew ${newCardsCount} new cards.`, false);
        }
        
        this.selectedCards.clear();
        this.opponentDraw();
    }

    opponentDraw() {
        const aiHand = this.opponentHand;
        const evalHand = this.evaluateHand(aiHand);
        let discards = [];
        
        if (evalHand.rank >= 4) {
            discards = [];
        } else if (evalHand.rank === 3 || evalHand.rank === 7 || evalHand.rank === 6) {
             const values = aiHand.map(c => c.value);
             const counts = {};
             values.forEach(v => counts[v] = (counts[v] || 0) + 1);
             const keepValue = parseInt(Object.keys(counts).find(k => counts[k] >= 3));
             aiHand.forEach((c, i) => {
                 if (c.value !== keepValue) discards.push(i);
             });
        } else if (evalHand.rank === 2 || evalHand.rank === 1) {
             const values = aiHand.map(c => c.value);
             const counts = {};
             values.forEach(v => counts[v] = (counts[v] || 0) + 1);
             aiHand.forEach((c, i) => {
                 if (counts[c.value] < 2) discards.push(i);
             });
        } else {
            const maxVal = Math.max(...aiHand.map(c => c.value));
            aiHand.forEach((c, i) => {
                if (c.value !== maxVal) discards.push(i);
            });
        }

        discards.sort((a, b) => b - a);
        discards.forEach(idx => {
            this.opponentHand.splice(idx, 1);
        });
        
        const newAiCards = this.deck.splice(0, discards.length);
        this.opponentHand.push(...newAiCards);
        
        const msg = discards.length === 0 ? "I'll stay with these." : `I'm taking ${discards.length} cards.`;
        this.showDialogue(msg, true);
        
        setTimeout(() => {
            this.gamePhase = 'betting2';
            const introMsg = this.starter === 'player' ? "Post-draw betting. Your move." : "Post-draw betting. I'll start.";
            this.showDialogue(introMsg, false);
            this.updateDisplay();
            this.updateButtons();
            
            if (this.starter === 'opponent') {
                setTimeout(() => this.opponentAction(), 1500);
            }
        }, 1500);
    }

    opponentAction() {
        if (this.gamePhase !== 'betting1' && this.gamePhase !== 'betting2') return;

        const opponent = this.opponents[this.currentOpponent];
        const opponentEval = this.evaluateHand(this.opponentHand);
        
        let action = 'call';
        const rand = Math.random();
        const handRank = opponentEval.rank;
        const betToCall = this.playerBet - this.opponentBet;
        const canCheck = (betToCall === 0);
        
        // Aggressive Factor based on opponent
        // Suzy (0) might be looser, Melissa (1) tighter? 
        // For now, general aggressive logic.

        if (this.gamePhase === 'betting1') {
            // Round 1
            if (handRank >= 2) { // Two Pair or better
                action = 'raise'; // Always build pot
            } else if (handRank === 1) { // Pair
                action = (rand < 0.6) ? 'raise' : 'call'; // 60% Raise
            } else { // High Card
                if (canCheck) {
                    action = (rand < 0.2) ? 'raise' : 'call'; // 20% Bluff, else Check
                } else {
                    action = (rand < 0.2) ? 'raise' : (rand < 0.6 ? 'call' : 'drop'); // 20% Bluff, 40% Call, 40% Fold
                }
            }
        } else {
            // Round 2 (Post Draw)
            if (handRank >= 3) { // Trips or better
                action = 'raise'; 
            } else if (handRank >= 1) { // Pair or Two Pair
                if (canCheck) {
                    action = (rand < 0.5) ? 'raise' : 'call';
                } else {
                    action = 'call'; // Don't fold a pair for a single bet usually
                }
            } else { // High Card
                 if (canCheck) {
                    action = (rand < 0.1) ? 'raise' : 'call'; // Rare bluff
                 } else {
                    action = (rand < 0.1) ? 'raise' : (rand < 0.2 ? 'call' : 'drop'); // Mostly fold to a bet
                 }
            }
        }
        
        // Sanity check: Can't raise if broke
        if (action === 'raise' && this.opponentPot < this.ante) action = 'call';
        
        this.executeOpponentAction(action);
    }

    executeOpponentAction(action) {
        switch(action) {
            case 'raise':
                const costToCall = this.playerBet - this.opponentBet;
                // Computer picks a raise amount between 5 and 25
                const possibleRaises = [5, 10, 15, 20, 25];
                const opponentEval = this.evaluateHand(this.opponentHand);
                
                // Aggressive AI: Better hand = higher raise
                let raiseIdx = Math.floor(Math.random() * 2); // default 5 or 10
                if (opponentEval.rank >= 3) raiseIdx = 2 + Math.floor(Math.random() * 3); // 15, 20, or 25
                else if (opponentEval.rank >= 1) raiseIdx = Math.floor(Math.random() * 3); // 5, 10, or 15
                
                const raiseAmt = possibleRaises[raiseIdx];
                const raiseCost = costToCall + raiseAmt;
                
                if (this.opponentPot < raiseCost) {
                    // Adjust to All-In if can't afford chosen raise
                    this.executeOpponentAction('call');
                    return;
                }

                this.opponentBet += raiseCost;
                this.opponentPot -= raiseCost;
                this.totalPot += raiseCost;
                this.currentBet = this.opponentBet;
                this.showDialogue(this.getRandomDialogue() + ` I RAISE $${raiseAmt}!`, true);
                break;
                
            case 'call':
                if (this.playerBet === this.opponentBet) {
                    this.showDialogue("I STAY.", true);
                } else {
                    const callAmt = this.playerBet - this.opponentBet;
                    this.opponentBet += callAmt;
                    this.opponentPot -= callAmt;
                    this.totalPot += callAmt;
                    this.showDialogue("I CALL.", true);
                }
                this.resolveBettingRound();
                return;
                
            case 'drop':
                this.showDialogue(this.getRandomDialogue() + " I DROP!", true);
                this.playerWins();
                return;
        }
        
        this.updateDisplay();
        this.updateButtons();
    }

    resolveBettingRound() {
        if (this.gamePhase === 'betting1') {
            this.gamePhase = 'drawing';
            this.updateDisplay();
            this.updateButtons();
            this.showDialogue("Select cards to discard, then click DRAW.", false);
        } else if (this.gamePhase === 'betting2') {
            this.showdown();
        }
    }

    getRandomDialogue() {
        const opponent = this.opponents[this.currentOpponent];
        return opponent.dialogue[Math.floor(Math.random() * opponent.dialogue.length)];
    }

    call() {
        const callAmount = this.currentBet - this.playerBet;
        if (this.playerPot < callAmount) {
             alert("You don't have enough money! You're betting your dignity (clothes)!");
        }
        
        this.playerBet += callAmount;
        this.playerPot -= callAmount;
        this.totalPot += callAmount;
        
        this.showDialogue("I CALL!", false);
        this.resolveBettingRound();
        this.updateDisplay();
    }

    raise() {
        const raiseSelect = document.getElementById('raise-amount');
        const amount = parseInt(raiseSelect.value);
        const raiseAmount = (this.currentBet - this.playerBet) + amount;
        
        if (this.playerPot < raiseAmount) {
            alert("Not enough funds to raise.");
            return;
        }

        this.playerBet += raiseAmount;
        this.playerPot -= raiseAmount;
        this.totalPot += raiseAmount;
        this.currentBet = this.playerBet;
        
        this.showDialogue(`I RAISE $${amount}!`, false);
        this.updateButtons();
        setTimeout(() => this.opponentAction(), 1500);
        this.updateDisplay();
    }

    stay() {
        if (this.currentBet > this.playerBet) {
            alert("You must Call or Drop!");
            return;
        }
        this.showDialogue("I CHECK.", false);
        setTimeout(() => this.opponentAction(), 1500);
    }

    drop() {
        this.showDialogue("I DROP!", false);
        this.opponentWins();
    }

    showdown() {
        this.gamePhase = 'showdown';
        const playerEval = this.evaluateHand(this.playerHand);
        const opponentEval = this.evaluateHand(this.opponentHand);
        
        this.updateDisplay();
        
        let result = "";
        let playerWon = false;
        
        if (playerEval.rank > opponentEval.rank) {
            playerWon = true;
            result = `YOU WIN! ${playerEval.name} beats ${opponentEval.name}`;
        } else if (opponentEval.rank > playerEval.rank) {
            playerWon = false;
            result = `YOU LOSE! ${opponentEval.name} beats ${playerEval.name}`;
        } else {
            if (playerEval.value > opponentEval.value) {
                playerWon = true;
                result = `TIE BREAKER! Your ${playerEval.name} wins!`;
            } else {
                playerWon = false;
                result = `TIE BREAKER! Opponent's ${opponentEval.name} wins!`;
            }
        }
        
        this.showGameMessage(result);
        
        setTimeout(() => {
            if (playerWon) this.playerWins();
            else this.opponentWins();
        }, 2000);
    }

    playerWins() {
        this.playerPot += this.totalPot;
        const winAmount = this.totalPot;
        this.totalPot = 0;
        
        if (winAmount >= 40) {
             this.winBackClothes();
        }
        
        const nextOpponentTriggered = this.stripOpponent();
        this.showGameMessage("YOU WIN THE POT!");

        if (!nextOpponentTriggered) {
            setTimeout(() => this.newRound(), 4000);
        }
    }

    opponentWins() {
        this.opponentPot += this.totalPot;
        this.totalPot = 0;
        
        if (this.playerPot < 0) {
            this.showDialogue("You're out of cash! Pay up with your clothes!");
            this.stripPlayer();
            this.playerPot = 50; 
        }
        
        this.showGameMessage("OPPONENT WINS THE POT!");
        setTimeout(() => this.newRound(), 4000);
    }

    stripOpponent() {
        const opponent = this.opponents[this.currentOpponent];
        const strippedItems = opponent.clothing.filter(item => 
            document.getElementById(item).classList.contains('clothed')
        );
        
        if (this.opponentPot <= 0) {
             if (strippedItems.length > 0) {
                const itemToStrip = strippedItems[strippedItems.length - 1];
                document.getElementById(itemToStrip).classList.remove('clothed');
                document.getElementById(itemToStrip).classList.add('stripped');
                
                this.showDialogue("I guess I have to take this off... *blush*", true);
                this.opponentPot = 50;
                
                if (strippedItems.length === 1) {
                    setTimeout(() => {
                        this.showGameMessage(`YOU WIN! ${opponent.name} IS COMPLETELY STRIPPED!`);
                        this.nextOpponent();
                    }, 3000);
                    return true;
                }
            }
        }
        return false;
    }
    
    stripPlayer() {
        this.showGameMessage("YOU LOST AN ITEM OF CLOTHING!");
    }

    winBackClothes() {
        // Placeholder for player winning back clothes mechanic
    }

    nextOpponent() {
        this.currentOpponent = (this.currentOpponent + 1) % this.opponents.length;
        const opponent = this.opponents[this.currentOpponent];
        
        opponent.clothing.forEach(item => {
            document.getElementById(item).classList.remove('stripped');
            document.getElementById(item).classList.add('clothed');
        });
        
        this.opponentPot = 100;
        this.showDialogue(`Meet your next opponent: ${opponent.name}!`, false);
        this.updateDisplay();
        
        setTimeout(() => this.newRound(), 4000);
    }

    showDialogue(text, isOpponent = true) {
        const dialogEl = document.getElementById('dialogue-text');
        
        // Add new message to history
        this.messageHistory.push({ text, isOpponent });
        
        // Keep only last 3 messages
        if (this.messageHistory.length > 3) {
            this.messageHistory.shift();
        }
        
        // Render history
        dialogEl.innerHTML = '';
        this.messageHistory.forEach((msg, index) => {
            const line = document.createElement('div');
            line.textContent = msg.text;
            line.className = msg.isOpponent ? 'opponent-dialogue' : 'player-dialogue';
            
            // Fade older messages slightly
            if (index < this.messageHistory.length - 1) {
                line.style.opacity = (index + 1) * 0.3;
            }
            
            dialogEl.appendChild(line);
        });
    }

    showGameMessage(text) {
        document.getElementById('game-message').textContent = text;
        this.showDialogue(text, false);
    }

    updateDisplay() {
        document.getElementById('player-pot').textContent = this.playerPot;
        document.getElementById('opponent-pot').textContent = this.opponentPot;
        document.getElementById('current-bet').textContent = this.currentBet;
        document.getElementById('total-pot').textContent = this.totalPot;
        document.getElementById('round-number').textContent = this.round;
        
        const opponent = this.opponents[this.currentOpponent];
        document.getElementById('opponent-name').textContent = opponent.name;
        document.getElementById('opponent-avatar').textContent = opponent.avatar;
        
        this.displayCards('player-cards', this.playerHand, true);
        
        if (this.gamePhase === 'showdown') {
             this.displayCards('opponent-cards', this.opponentHand, true);
        } else {
             this.displayBacks('opponent-cards', this.opponentHand.length);
        }
    }
    
    updateButtons() {
        const bettingArea = document.querySelector('.betting-buttons');
        const drawArea = document.querySelector('.draw-controls');
        
        if (this.gamePhase === 'drawing') {
            bettingArea.style.display = 'none';
            drawArea.classList.add('visible');
        } else {
            bettingArea.style.display = 'flex';
            drawArea.classList.remove('visible');
        }
    }

    displayCards(containerId, hand, isPlayer) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        hand.forEach((card, index) => {
            const cardElement = document.createElement('div');
            cardElement.className = `card ${card.suit === '♥' || card.suit === '♦' ? 'red' : 'black'}`;
            if (isPlayer && this.selectedCards.has(index)) {
                cardElement.classList.add('selected');
            }
            cardElement.textContent = `${card.rank}${card.suit}`;
            
            if (isPlayer) {
                cardElement.onclick = () => this.toggleCardSelection(index);
                cardElement.style.cursor = 'pointer';
            }
            
            container.appendChild(cardElement);
        });
    }
    
    displayBacks(containerId, count) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        for(let i=0; i<count; i++) {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';
            cardElement.style.background = '#607D8B';
            cardElement.textContent = '🂠';
            container.appendChild(cardElement);
        }
    }

    newGame() {
        this.playerPot = 100;
        this.opponentPot = 100;
        this.round = 1;
        this.currentOpponent = 0;
        
        this.opponents.forEach(opponent => {
            opponent.clothing.forEach(item => {
                const element = document.getElementById(item);
                if (element) {
                    element.classList.remove('stripped');
                    element.classList.add('clothed');
                }
            });
        });
        
        this.showDialogue("New game! Let's start fresh.", false);
        this.newRound();
    }

    showRules() {
        alert(`STRIP POKER RULES (ATARI STYLE):

1. 5-Card Draw Poker.
2. Ante $5.
3. Betting Round 1.
4. Draw Phase (Discard/Replace cards).
5. Betting Round 2.
6. Showdown.
7. If you run out of cash, you bet clothes (refill $50).
8. Strip opponent completely to win!`);
    }
}

let game;
document.addEventListener('DOMContentLoaded', function() {
    game = new StripPokerGame();
    window.game = game;
});