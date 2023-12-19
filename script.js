document.addEventListener('DOMContentLoaded', () => {
    const cells = document.querySelectorAll('.grid-cell');
    const submitButton = document.getElementById('submit');
    const validWords = ['AAH', 'AAL', 'AAS', 'ABA', 'ABO', 'ABS', 'ABY', 'ACE', 'ACT', 'ADD', 'ADO', 'ADS', 'ADZ', 'AFF', 'AFT', 'AGA', 'AGE', 'AGO', 'AGS', 'AHA', 'AHI', 'AHS', 'AID', 'AIL', 'AIM', 'AIN', 'AIR', 'AIS', 'AIT', 'ALA', 'ALB', 'ALE', 'ALL', 'ALP', 'ALS', 'ALT', 'AMA', 'AMI', 'AMP', 'AMU', 'ANA', 'AND', 'ANE', 'ANI', 'ANT', 'ANY', 'APE', 'APO', 'APP', 'APT', 'ARB', 'ARC', 'ARE', 'ARF', 'ARK', 'ARM', 'ARS', 'ART', 'ASH', 'ASK', 'ASP', 'ASS', 'ATE', 'ATT', 'AUK', 'AVA', 'AVE', 'AVO', 'AWA', 'AWE', 'AWL', 'AWN', 'AXE', 'AYE', 'AYS', 'AZO', 'BAA', 'BAD', 'BAG', 'BAH', 'BAL', 'BAM', 'BAN', 'BAP', 'BAR', 'BAS', 'BAT', 'BAY', 'BED', 'BEE', 'BEG', 'BEL', 'BEN', 'BES', 'BET', 'BEY', 'BIB', 'BID', 'BIG', 'BIN', 'BIO', 'BIS', 'BIT', 'BIZ', 'BOA', 'BOB', 'BOD', 'BOG', 'BOO', 'BOP', 'BOS', 'BOT', 'BOW', 'BOX', 'BOY', 'BRA', 'BRO', 'BRR', 'BUB', 'BUD', 'BUG', 'BUM', 'BUN', 'BUR', 'BUS', 'BUT', 'BUY', 'BYE', 'BYS', 'CAB', 'CAD', 'CAM', 'CAN', 'CAP', 'CAR', 'CAT', 'CAW', 'CAY', 'CEE', 'CEL', 'CEP', 'CHI', 'CIG', 'CIS', 'COB', 'COD', 'COG', 'COL', 'CON', 'COO', 'COP', 'COR', 'COS', 'COT', 'COW', 'COX', 'COY', 'COZ', 'CRU', 'CRY', 'CUB', 'CUD', 'CUE', 'CUM', 'CUP', 'CUR', 'CUT', 'CWM', 'DAB', 'DAD', 'DAG', 'DAH', 'DAK', 'DAL', 'DAM', 'DAN', 'DAP', 'DAW', 'DAY', 'DEB', 'DEE', 'DEF', 'DEL', 'DEN', 'DEV', 'DEW', 'DEX', 'DEY', 'DIB', 'DID', 'DIE', 'DIF', 'DIG', 'DIM', 'DIN', 'DIP', 'DIS', 'DIT', 'DOC', 'DOE', 'DOG', 'DOL', 'DOM', 'DON', 'DOR', 'DOS', 'DOT', 'DOW', 'DRY', 'DUB', 'DUD', 'DUE', 'DUG', 'DUH', 'DUI', 'DUN', 'DUO', 'DUP', 'DYE', 'EAR', 'EAT', 'EAU', 'EBB', 'ECU', 'EDH', 'EDS', 'EEK', 'EEL', 'EFF', 'EFS', 'EFT', 'EGG', 'EGO', 'EKE', 'ELD', 'ELF', 'ELK', 'ELL', 'ELM', 'ELS', 'EME', 'EMS', 'EMU', 'END', 'ENG', 'ENS', 'EON', 'ERA', 'ERE', 'ERG', 'ERN', 'ERR', 'ERS', 'ESS', 'ETA', 'ETH', 'EVE', 'EWE', 'EYE', 'FAB', 'FAD', 'FAG', 'FAN', 'FAR', 'FAS', 'FAT', 'FAX', 'FAY', 'FED', 'FEE', 'FEH', 'FEM', 'FEN', 'FER', 'FES', 'FET', 'FEU', 'FEW', 'FEY', 'FEZ', 'FIB', 'FID', 'FIE', 'FIG', 'FIL', 'FIN', 'FIR', 'FIT', 'FIX', 'FIZ', 'FLU', 'FLY', 'FOB', 'FOE', 'FOG', 'FOH', 'FON', 'FOP', 'FOR', 'FOU', 'FOX', 'FOY', 'FRO', 'FRY', 'FUB', 'FUD', 'FUG', 'FUN', 'FUR', 'GAB', 'GAD', 'GAE', 'GAG', 'GAL', 'GAM', 'GAN', 'GAP', 'GAR', 'GAS', 'GAT', 'GAY', 'GED', 'GEE', 'GEL', 'GEM', 'GEN', 'GET', 'GEY', 'GHI', 'GIB', 'GID', 'GIE', 'GIG', 'GIN', 'GIP', 'GIT', 'GNU', 'GOA', 'GOB', 'GOD', 'GOO', 'GOR', 'GOS', 'GOT', 'GOX', 'GOY', 'GUL', 'GUM', 'GUN', 'GUT', 'GUV', 'GUY', 'GYM', 'GYP', 'HAD', 'HAE', 'HAG', 'HAH', 'HAJ', 'HAM', 'HAO', 'HAP', 'HAS', 'HAT', 'HAW', 'HAY', 'HEH', 'HEM', 'HEN', 'HEP', 'HER', 'HES', 'HET', 'HEW', 'HEX', 'HEY', 'HIC', 'HID', 'HIE', 'HIM', 'HIN', 'HIP', 'HIS', 'HIT', 'HMM', 'HOB', 'HOD', 'HOE', 'HOG', 'HON', 'HOP', 'HOS', 'HOT', 'HOW', 'HOY', 'HUB', 'HUE', 'HUG', 'HUH', 'HUM', 'HUN', 'HUP', 'HUT', 'HYP', 'ICE', 'ICH', 'ICK', 'ICY', 'IDS', 'IFF', 'IFS', 'IGG', 'ILK', 'ILL', 'IMP', 'INK', 'INN', 'INS', 'ION', 'IRE', 'IRK', 'ISM', 'ITS', 'IVY', 'JAB', 'JAG', 'JAM', 'JAR', 'JAW', 'JAY', 'JEE', 'JET', 'JEU', 'JEW', 'JIB', 'JIG', 'JIN', 'JOB', 'JOE', 'JOG', 'JOT', 'JOW', 'JOY', 'JUG', 'JUN', 'JUS', 'JUT', 'KAB', 'KAE', 'KAF', 'KAS', 'KAT', 'KAY', 'KEA', 'KEF', 'KEG', 'KEN', 'KEP', 'KEX', 'KEY', 'KHI', 'KID', 'KIF', 'KIN', 'KIP', 'KIR', 'KIS', 'KIT', 'KOA', 'KOB', 'KOI', 'KOP', 'KOR', 'KOS', 'KUE', 'KYE', 'LAB', 'LAC', 'LAD', 'LAG', 'LAM', 'LAP', 'LAR', 'LAS', 'LAT', 'LAV', 'LAW', 'LAX', 'LAY', 'LEA', 'LED', 'LEE', 'LEG', 'LEI', 'LEK', 'LES', 'LET', 'LEU', 'LEV', 'LEX', 'LEY', 'LEZ', 'LIB', 'LID', 'LIE', 'LIN', 'LIP', 'LIS', 'LIT', 'LOB', 'LOG', 'LOO', 'LOP', 'LOT', 'LOW', 'LOX', 'LUG', 'LUM', 'LUV', 'LUX', 'LYE', 'MAC', 'MAD', 'MAE', 'MAG', 'MAN', 'MAP', 'MAR', 'MAS', 'MAT', 'MAW', 'MAX', 'MAY', 'MED', 'MEG', 'MEL', 'MEM', 'MEN', 'MET', 'MEW', 'MHO', 'MIB', 'MIC', 'MID', 'MIG', 'MIL', 'MIM', 'MIR', 'MIS', 'MIX', 'MOA', 'MOB', 'MOC', 'MOD', 'MOG', 'MOL', 'MOM', 'MON', 'MOO', 'MOP', 'MOR', 'MOS', 'MOT', 'MOW', 'MUD', 'MUG', 'MUM', 'MUN', 'MUS', 'MUT', 'MYC', 'NAB', 'NAE', 'NAG', 'NAH', 'NAM', 'NAN', 'NAP', 'NAW', 'NAY', 'NEB', 'NEE', 'NEG', 'NET', 'NEW', 'NIB', 'NIL', 'NIM', 'NIP', 'NIT', 'NIX', 'NOB', 'NOD', 'NOG', 'NOH', 'NOM', 'NOO', 'NOR', 'NOS', 'NOT', 'NOW', 'NTH', 'NUB', 'NUN', 'NUS', 'NUT', 'OAF', 'OAK', 'OAR', 'OAT', 'OBA', 'OBE', 'OBI', 'OCA', 'ODA', 'ODD', 'ODE', 'ODS', 'OES', 'OFF', 'OFT', 'OHM', 'OHO', 'OHS', 'OIL', 'OKA', 'OKE', 'OLD', 'OLE', 'OMS', 'ONE', 'ONO', 'ONS', 'OOH', 'OOT', 'OPE', 'OPS', 'OPT', 'ORA', 'ORB', 'ORC', 'ORE', 'ORS', 'ORT', 'OSE', 'OUD', 'OUR', 'OUT', 'OVA', 'OWE', 'OWL', 'OWN', 'OXO', 'OXY', 'PAC', 'PAD', 'PAH', 'PAL', 'PAM', 'PAN', 'PAP', 'PAR', 'PAS', 'PAT', 'PAW', 'PAX', 'PAY', 'PEA', 'PEC', 'PED', 'PEE', 'PEG', 'PEH', 'PEN', 'PEP', 'PER', 'PES', 'PET', 'PEW', 'PHI', 'PHT', 'PIA', 'PIC', 'PIE', 'PIG', 'PIN', 'PIP', 'PIS', 'PIT', 'PIU', 'PIX', 'PLY', 'POD', 'POH', 'POI', 'POL', 'POM', 'POO', 'POP', 'POT', 'POW', 'POX', 'PRO', 'PRY', 'PSI', 'PST', 'PUB', 'PUD', 'PUG', 'PUL', 'PUN', 'PUP', 'PUR', 'PUS', 'PUT', 'PYA', 'PYE', 'PYX', 'QAT', 'QIS', 'QUA', 'RAD', 'RAG', 'RAH', 'RAI', 'RAJ', 'RAM', 'RAN', 'RAP', 'RAS', 'RAT', 'RAW', 'RAX', 'RAY', 'REB', 'REC', 'RED', 'REE', 'REF', 'REG', 'REI', 'REM', 'REP', 'RES', 'RET', 'REV', 'REX', 'RHO', 'RIA', 'RIB', 'RID', 'RIF', 'RIG', 'RIM', 'RIN', 'RIP', 'ROB', 'ROC', 'ROD', 'ROE', 'ROM', 'ROT', 'ROW', 'RUB', 'RUE', 'RUG', 'RUM', 'RUN', 'RUT', 'RYA', 'RYE', 'SAB', 'SAC', 'SAD', 'SAE', 'SAG', 'SAL', 'SAP', 'SAT', 'SAU', 'SAW', 'SAX', 'SAY', 'SEA', 'SEC', 'SEE', 'SEG', 'SEI', 'SEL', 'SEN', 'SER', 'SET', 'SEW', 'SEX', 'SHA', 'SHE', 'SHH', 'SHY', 'SIB', 'SIC', 'SIM', 'SIN', 'SIP', 'SIR', 'SIS', 'SIT', 'SIX', 'SKA', 'SKI', 'SKY', 'SLY', 'SOB', 'SOD', 'SOL', 'SOM', 'SON', 'SOP', 'SOS', 'SOT', 'SOU', 'SOW', 'SOX', 'SOY', 'SPA', 'SPY', 'SRI', 'STY', 'SUB', 'SUE', 'SUK', 'SUM', 'SUN', 'SUP', 'SUQ', 'SYN', 'TAB', 'TAD', 'TAE', 'TAG', 'TAJ', 'TAM', 'TAN', 'TAO', 'TAP', 'TAR', 'TAS', 'TAT', 'TAU', 'TAV', 'TAW', 'TAX', 'TEA', 'TEE', 'TEG', 'TEL', 'TEN', 'TET', 'TEW', 'THE', 'THO', 'THY', 'TIC', 'TIE', 'TIL', 'TIN', 'TIP', 'TIS', 'TIT', 'TOD', 'TOE', 'TOG', 'TOM', 'TON', 'TOO', 'TOP', 'TOR', 'TOT', 'TOW', 'TOY', 'TRY', 'TSK', 'TUB', 'TUG', 'TUI', 'TUN', 'TUP', 'TUT', 'TUX', 'TWA', 'TWO', 'TYE', 'UDO', 'UGH', 'UKE', 'ULU', 'UMM', 'UMP', 'UNS', 'UPO', 'UPS', 'URB', 'URD', 'URN', 'URP', 'USE', 'UTA', 'UTE', 'UTS', 'VAC', 'VAN', 'VAR', 'VAS', 'VAT', 'VAU', 'VAV', 'VAW', 'VEE', 'VEG', 'VET', 'VEX', 'VIA', 'VID', 'VIE', 'VIG', 'VIM', 'VIS', 'VOE', 'VOW', 'VOX', 'VUG', 'VUM', 'WAB', 'WAD', 'WAE', 'WAG', 'WAN', 'WAP', 'WAR', 'WAS', 'WAT', 'WAW', 'WAX', 'WAY', 'WEB', 'WED', 'WEE', 'WEN', 'WET', 'WHA', 'WHO', 'WHY', 'WIG', 'WIN', 'WIS', 'WIT', 'WIZ', 'WOE', 'WOG', 'WOK', 'WON', 'WOO', 'WOP', 'WOS', 'WOT', 'WOW', 'WRY', 'WUD', 'WYE', 'WYN', 'XIS', 'YAG', 'YAH', 'YAK', 'YAM', 'YAP', 'YAR', 'YAW', 'YAY', 'YEA', 'YEH', 'YEN', 'YEP', 'YES', 'YET', 'YEW', 'YID', 'YIN', 'YIP', 'YOB', 'YOD', 'YOK', 'YOM', 'YON', 'YOU', 'YOW', 'YUK', 'YUM', 'YUP', 'ZAG', 'ZAP', 'ZAS', 'ZAX', 'ZED', 'ZEE', 'ZEK', 'ZEP', 'ZIG', 'ZIN', 'ZIP', 'ZIT', 'ZOA', 'ZOO', 'ZUZ', 'ZZZ'];
    let firstSelectedCell = null; // To keep track of the first selected cell for swapping
    let foundSolutions = [];

    // Event listener for the submit button
    submitButton.addEventListener('click', () => {
        if (isCrosswordValid()) {
            //alert('Congratulations! You have made a valid crossword!');
        } else {
            //alert('Try again! The crossword is not valid.');
        }
    });

    // Function to check if the crossword is valid
    function isCrosswordValid() {
        // Check each row and column for valid words
        const grid = Array.from(document.querySelectorAll('.grid-cell')).map(cell => cell.textContent || ' ');
        // Logic to validate the words formed in the grid goes here
        for (let i = 0; i < 3; i++) {
            // Check rows and columns...
            const rowWord = grid.slice(i * 3, i * 3 + 3).join('');
            const colWord = grid[i] + grid[i + 3] + grid[i + 6];
            if (!validWords.includes(rowWord) || !validWords.includes(colWord)) {
                return false;
            }
        }
        return true;
    }

    // Pre-populate the grid with randomized letters
    const letters = ['C', 'E', 'G', 'N', 'E', 'A', 'T', 'B', 'I'];
    shuffleArray(letters); // Randomize the letters array
    cells.forEach((cell, index) => {
        cell.textContent = letters[index];
        cell.classList.add('grid-cell'); // Ensure this is the correct class for your cells
    });

    // Click event for selecting and swapping letters
    cells.forEach(cell => {
        cell.addEventListener('click', () => {
            if (firstSelectedCell === null) {
                firstSelectedCell = cell; // Select the first cell
                cell.classList.add('selected');
            } else {
                if (cell !== firstSelectedCell) {
                    animateSwap(firstSelectedCell, cell);
                }
                firstSelectedCell.classList.remove('selected');
                firstSelectedCell = null; // Reset the selection
            }
        });
    });

    // Function to shuffle an array
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function animateSwap(cell1, cell2) {
        // Hide the original cells
        cell1.style.visibility = 'hidden';
        cell2.style.visibility = 'hidden';

        // Create clones of the cells to animate
        const clone1 = cell1.cloneNode(true);
        const clone2 = cell2.cloneNode(true);

        // Position the clones on top of the original cells
        positionClone(clone1, cell1);
        positionClone(clone2, cell2);

        // Append the clones to the body for animation
        document.body.appendChild(clone1);
        document.body.appendChild(clone2);

        // Calculate the distance to translate
        const cell1Rect = cell1.getBoundingClientRect();
        const cell2Rect = cell2.getBoundingClientRect();
        const translateX = cell2Rect.left - cell1Rect.left;
        const translateY = cell2Rect.top - cell1Rect.top;

        // Animate the clones moving to the new positions
        requestAnimationFrame(() => {
            clone1.style.visibility = 'visible';
            clone2.style.visibility = 'visible';
            clone1.style.transform = `translate(${translateX}px, ${translateY}px)`;
            clone2.style.transform = `translate(${-translateX}px, ${-translateY}px)`;
        });

        // Set a timeout to swap the letters, show the original cells, and remove the clones after the animation is complete
        setTimeout(() => {
            // Swap the text content of the original cells
            const tempText = cell1.textContent;
            cell1.textContent = cell2.textContent;
            cell2.textContent = tempText;

            // Show the original cells again
            clone1.style.visibility = 'hidden';
            clone2.style.visibility = 'hidden';
            cell1.style.visibility = 'visible';
            cell2.style.visibility = 'visible';

            // Remove the clones from the body
            document.body.removeChild(clone1);
            document.body.removeChild(clone2);
        }, 300); // This timeout duration should match the CSS transition duration
    }

    function positionClone(clone, original) {
        const rect = original.getBoundingClientRect();
        clone.style.position = 'absolute';
        clone.style.left = `${rect.left}px`;
        clone.style.top = `${rect.top}px`;
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        clone.classList.add('clone'); // Add a class for styling the clone if needed
        clone.style.transition = 'transform 0.3s ease-in-out';
        clone.style.zIndex = 1000;
        // Remove any other styles that might interfere with the visibility of the clone
    }




    


    function isCrosswordValid() {
        const grid = Array.from(document.querySelectorAll('.grid-cell')).map(cell => cell.textContent || ' ');
        let isValid = true;
        let delay = 0;
        const animationDuration = 400; // Duration of each animation

        // Animate rows first
        for (let i = 0; i < 3; i++) {
            const rowWord = grid.slice(i * 3, i * 3 + 3).join('');
            setTimeout(() => {
                if (!validWords.includes(rowWord)) {
                    shakeRow(i);
                    isValid = false;
                } else {
                    hopRow(i);
                }
            }, delay);
            delay += animationDuration;
        }

        // Wait for row animations to complete before starting column animations
        setTimeout(() => {
            for (let i = 0; i < 3; i++) {
                const colWord = grid[i] + grid[i + 3] + grid[i + 6];
                setTimeout(() => {
                    if (!validWords.includes(colWord)) {
                        shakeColumn(i);
                        isValid = false;
                    } else {
                        hopColumn(i);
                    }
                }, delay);
                delay += animationDuration;
            }
        }, 50);
        
        setTimeout(() => {
        if (isValid) {
            let currentSolution = getCurrentSolution();
                    if (!foundSolutions.includes(currentSolution)) {
                        foundSolutions.push(currentSolution);
                        triggerConfetti();
                        updateCongratsMessage(foundSolutions.length);
                    } else {
                        triggerConfetti();
                        alreadyFoundCongratsMessage(foundSolutions.length);
                    }
                } else {
                    // Handle invalid crossword case
                }
    }, 2400);

    return isValid;
}
function getCurrentSolution() {
    return Array.from(document.querySelectorAll('.grid-cell')).map(cell => cell.textContent).join('');
}

function updateCongratsMessage(solutionCount) {
    const message = document.querySelector('#congratsOverlay p');
    message.textContent = `You found ${solutionCount} unique solution${solutionCount !== 1 ? 's' : ''}! There may be more.`;
}
function alreadyFoundCongratsMessage(solutionCount) {
    const message = document.querySelector('#congratsOverlay p');
    message.textContent = `You've found this one already, making ${solutionCount} unique solution${solutionCount !== 1 ? 's' : ''}!\nThere may be more.`;
}

function triggerConfetti() {
    // Get the grid's position
    const gridRect = document.getElementById('crosswordGrid').getBoundingClientRect();

    // Calculate scale factors based on window size
    const scaleFactor = Math.max(window.innerWidth, window.innerHeight) / 500;
    const particleCount = Math.floor(100 * scaleFactor);
    const spread = Math.max(70, 60 * scaleFactor);
    const startVelocity = 30 * scaleFactor;
    const particleSize = Math.max(7, 10 * scaleFactor);

    // Confetti from the left of the grid
    confetti({
        particleCount,
        angle: 60,
        spread,
        startVelocity,
        particleSize,
        origin: { x: gridRect.left / window.innerWidth, y: gridRect.bottom / window.innerHeight }
    });

    // Confetti from the right of the grid
    confetti({
        particleCount,
        angle: 120,
        spread,
        startVelocity,
        particleSize,
        origin: { x: (gridRect.right / window.innerWidth), y: gridRect.bottom / window.innerHeight }
    });
    // Show the overlay after the confetti effect
        setTimeout(() => {
            document.getElementById('congratsOverlay').classList.replace('hidden', 'visible');
        }, 1000); // Adjust the timeout as needed
    }

    document.getElementById('keepPlaying').addEventListener('click', function() {
        document.getElementById('congratsOverlay').classList.replace('visible', 'hidden');
    });



    function applyAnimationToCells(cells, animationClass) {
        cells.forEach(cell => {
            cell.classList.add(animationClass);
            setTimeout(() => cell.classList.remove(animationClass), 400); // Clear effect after 1 second
        });
    }

    function shakeRow(rowIndex) {
        const cells = Array.from(document.querySelectorAll('.grid-cell')).slice(rowIndex * 3, rowIndex * 3 + 3);
        applyAnimationToCells(cells, 'shake');
    }

    function hopRow(rowIndex) {
        const cells = Array.from(document.querySelectorAll('.grid-cell')).slice(rowIndex * 3, rowIndex * 3 + 3);
        applyAnimationToCells(cells, 'hop');
    }

    function shakeColumn(colIndex) {
        const cells = [0, 1, 2].map(i => document.getElementById(`cell${colIndex + i * 3 + 1}`));
        applyAnimationToCells(cells, 'shake');
    }

    function hopColumn(colIndex) {
        const cells = [0, 1, 2].map(i => document.getElementById(`cell${colIndex + i * 3 + 1}`));
        applyAnimationToCells(cells, 'hop');
    }


});
