document.addEventListener('DOMContentLoaded', () => {
    const letterBlocks = document.getElementById('letterBlocks');
    const cells = document.querySelectorAll('.grid-cell');
    const submitButton = document.getElementById('submit');
    let selectedBlock = null; // To keep track of the selected letter block
    let draggedElement = null; // To keep track of the dragged element

    // A hardcoded list of valid 3-letter words
    const validWords = ['AAH', 'AAL', 'AAS', 'ABA', 'ABO', 'ABS', 'ABY', 'ACE', 'ACT', 'ADD', 'ADO', 'ADS', 'ADZ', 'AFF', 'AFT', 'AGA', 'AGE', 'AGO', 'AGS', 'AHA', 'AHI', 'AHS', 'AID', 'AIL', 'AIM', 'AIN', 'AIR', 'AIS', 'AIT', 'ALA', 'ALB', 'ALE', 'ALL', 'ALP', 'ALS', 'ALT', 'AMA', 'AMI', 'AMP', 'AMU', 'ANA', 'AND', 'ANE', 'ANI', 'ANT', 'ANY', 'APE', 'APO', 'APP', 'APT', 'ARB', 'ARC', 'ARE', 'ARF', 'ARK', 'ARM', 'ARS', 'ART', 'ASH', 'ASK', 'ASP', 'ASS', 'ATE', 'ATT', 'AUK', 'AVA', 'AVE', 'AVO', 'AWA', 'AWE', 'AWL', 'AWN', 'AXE', 'AYE', 'AYS', 'AZO', 'BAA', 'BAD', 'BAG', 'BAH', 'BAL', 'BAM', 'BAN', 'BAP', 'BAR', 'BAS', 'BAT', 'BAY', 'BED', 'BEE', 'BEG', 'BEL', 'BEN', 'BES', 'BET', 'BEY', 'BIB', 'BID', 'BIG', 'BIN', 'BIO', 'BIS', 'BIT', 'BIZ', 'BOA', 'BOB', 'BOD', 'BOG', 'BOO', 'BOP', 'BOS', 'BOT', 'BOW', 'BOX', 'BOY', 'BRA', 'BRO', 'BRR', 'BUB', 'BUD', 'BUG', 'BUM', 'BUN', 'BUR', 'BUS', 'BUT', 'BUY', 'BYE', 'BYS', 'CAB', 'CAD', 'CAM', 'CAN', 'CAP', 'CAR', 'CAT', 'CAW', 'CAY', 'CEE', 'CEL', 'CEP', 'CHI', 'CIG', 'CIS', 'COB', 'COD', 'COG', 'COL', 'CON', 'COO', 'COP', 'COR', 'COS', 'COT', 'COW', 'COX', 'COY', 'COZ', 'CRU', 'CRY', 'CUB', 'CUD', 'CUE', 'CUM', 'CUP', 'CUR', 'CUT', 'CWM', 'DAB', 'DAD', 'DAG', 'DAH', 'DAK', 'DAL', 'DAM', 'DAN', 'DAP', 'DAW', 'DAY', 'DEB', 'DEE', 'DEF', 'DEL', 'DEN', 'DEV', 'DEW', 'DEX', 'DEY', 'DIB', 'DID', 'DIE', 'DIF', 'DIG', 'DIM', 'DIN', 'DIP', 'DIS', 'DIT', 'DOC', 'DOE', 'DOG', 'DOL', 'DOM', 'DON', 'DOR', 'DOS', 'DOT', 'DOW', 'DRY', 'DUB', 'DUD', 'DUE', 'DUG', 'DUH', 'DUI', 'DUN', 'DUO', 'DUP', 'DYE', 'EAR', 'EAT', 'EAU', 'EBB', 'ECU', 'EDH', 'EDS', 'EEK', 'EEL', 'EFF', 'EFS', 'EFT', 'EGG', 'EGO', 'EKE', 'ELD', 'ELF', 'ELK', 'ELL', 'ELM', 'ELS', 'EME', 'EMS', 'EMU', 'END', 'ENG', 'ENS', 'EON', 'ERA', 'ERE', 'ERG', 'ERN', 'ERR', 'ERS', 'ESS', 'ETA', 'ETH', 'EVE', 'EWE', 'EYE', 'FAB', 'FAD', 'FAG', 'FAN', 'FAR', 'FAS', 'FAT', 'FAX', 'FAY', 'FED', 'FEE', 'FEH', 'FEM', 'FEN', 'FER', 'FES', 'FET', 'FEU', 'FEW', 'FEY', 'FEZ', 'FIB', 'FID', 'FIE', 'FIG', 'FIL', 'FIN', 'FIR', 'FIT', 'FIX', 'FIZ', 'FLU', 'FLY', 'FOB', 'FOE', 'FOG', 'FOH', 'FON', 'FOP', 'FOR', 'FOU', 'FOX', 'FOY', 'FRO', 'FRY', 'FUB', 'FUD', 'FUG', 'FUN', 'FUR', 'GAB', 'GAD', 'GAE', 'GAG', 'GAL', 'GAM', 'GAN', 'GAP', 'GAR', 'GAS', 'GAT', 'GAY', 'GED', 'GEE', 'GEL', 'GEM', 'GEN', 'GET', 'GEY', 'GHI', 'GIB', 'GID', 'GIE', 'GIG', 'GIN', 'GIP', 'GIT', 'GNU', 'GOA', 'GOB', 'GOD', 'GOO', 'GOR', 'GOS', 'GOT', 'GOX', 'GOY', 'GUL', 'GUM', 'GUN', 'GUT', 'GUV', 'GUY', 'GYM', 'GYP', 'HAD', 'HAE', 'HAG', 'HAH', 'HAJ', 'HAM', 'HAO', 'HAP', 'HAS', 'HAT', 'HAW', 'HAY', 'HEH', 'HEM', 'HEN', 'HEP', 'HER', 'HES', 'HET', 'HEW', 'HEX', 'HEY', 'HIC', 'HID', 'HIE', 'HIM', 'HIN', 'HIP', 'HIS', 'HIT', 'HMM', 'HOB', 'HOD', 'HOE', 'HOG', 'HON', 'HOP', 'HOS', 'HOT', 'HOW', 'HOY', 'HUB', 'HUE', 'HUG', 'HUH', 'HUM', 'HUN', 'HUP', 'HUT', 'HYP', 'ICE', 'ICH', 'ICK', 'ICY', 'IDS', 'IFF', 'IFS', 'IGG', 'ILK', 'ILL', 'IMP', 'INK', 'INN', 'INS', 'ION', 'IRE', 'IRK', 'ISM', 'ITS', 'IVY', 'JAB', 'JAG', 'JAM', 'JAR', 'JAW', 'JAY', 'JEE', 'JET', 'JEU', 'JEW', 'JIB', 'JIG', 'JIN', 'JOB', 'JOE', 'JOG', 'JOT', 'JOW', 'JOY', 'JUG', 'JUN', 'JUS', 'JUT', 'KAB', 'KAE', 'KAF', 'KAS', 'KAT', 'KAY', 'KEA', 'KEF', 'KEG', 'KEN', 'KEP', 'KEX', 'KEY', 'KHI', 'KID', 'KIF', 'KIN', 'KIP', 'KIR', 'KIS', 'KIT', 'KOA', 'KOB', 'KOI', 'KOP', 'KOR', 'KOS', 'KUE', 'KYE', 'LAB', 'LAC', 'LAD', 'LAG', 'LAM', 'LAP', 'LAR', 'LAS', 'LAT', 'LAV', 'LAW', 'LAX', 'LAY', 'LEA', 'LED', 'LEE', 'LEG', 'LEI', 'LEK', 'LES', 'LET', 'LEU', 'LEV', 'LEX', 'LEY', 'LEZ', 'LIB', 'LID', 'LIE', 'LIN', 'LIP', 'LIS', 'LIT', 'LOB', 'LOG', 'LOO', 'LOP', 'LOT', 'LOW', 'LOX', 'LUG', 'LUM', 'LUV', 'LUX', 'LYE', 'MAC', 'MAD', 'MAE', 'MAG', 'MAN', 'MAP', 'MAR', 'MAS', 'MAT', 'MAW', 'MAX', 'MAY', 'MED', 'MEG', 'MEL', 'MEM', 'MEN', 'MET', 'MEW', 'MHO', 'MIB', 'MIC', 'MID', 'MIG', 'MIL', 'MIM', 'MIR', 'MIS', 'MIX', 'MOA', 'MOB', 'MOC', 'MOD', 'MOG', 'MOL', 'MOM', 'MON', 'MOO', 'MOP', 'MOR', 'MOS', 'MOT', 'MOW', 'MUD', 'MUG', 'MUM', 'MUN', 'MUS', 'MUT', 'MYC', 'NAB', 'NAE', 'NAG', 'NAH', 'NAM', 'NAN', 'NAP', 'NAW', 'NAY', 'NEB', 'NEE', 'NEG', 'NET', 'NEW', 'NIB', 'NIL', 'NIM', 'NIP', 'NIT', 'NIX', 'NOB', 'NOD', 'NOG', 'NOH', 'NOM', 'NOO', 'NOR', 'NOS', 'NOT', 'NOW', 'NTH', 'NUB', 'NUN', 'NUS', 'NUT', 'OAF', 'OAK', 'OAR', 'OAT', 'OBA', 'OBE', 'OBI', 'OCA', 'ODA', 'ODD', 'ODE', 'ODS', 'OES', 'OFF', 'OFT', 'OHM', 'OHO', 'OHS', 'OIL', 'OKA', 'OKE', 'OLD', 'OLE', 'OMS', 'ONE', 'ONO', 'ONS', 'OOH', 'OOT', 'OPE', 'OPS', 'OPT', 'ORA', 'ORB', 'ORC', 'ORE', 'ORS', 'ORT', 'OSE', 'OUD', 'OUR', 'OUT', 'OVA', 'OWE', 'OWL', 'OWN', 'OXO', 'OXY', 'PAC', 'PAD', 'PAH', 'PAL', 'PAM', 'PAN', 'PAP', 'PAR', 'PAS', 'PAT', 'PAW', 'PAX', 'PAY', 'PEA', 'PEC', 'PED', 'PEE', 'PEG', 'PEH', 'PEN', 'PEP', 'PER', 'PES', 'PET', 'PEW', 'PHI', 'PHT', 'PIA', 'PIC', 'PIE', 'PIG', 'PIN', 'PIP', 'PIS', 'PIT', 'PIU', 'PIX', 'PLY', 'POD', 'POH', 'POI', 'POL', 'POM', 'POO', 'POP', 'POT', 'POW', 'POX', 'PRO', 'PRY', 'PSI', 'PST', 'PUB', 'PUD', 'PUG', 'PUL', 'PUN', 'PUP', 'PUR', 'PUS', 'PUT', 'PYA', 'PYE', 'PYX', 'QAT', 'QIS', 'QUA', 'RAD', 'RAG', 'RAH', 'RAI', 'RAJ', 'RAM', 'RAN', 'RAP', 'RAS', 'RAT', 'RAW', 'RAX', 'RAY', 'REB', 'REC', 'RED', 'REE', 'REF', 'REG', 'REI', 'REM', 'REP', 'RES', 'RET', 'REV', 'REX', 'RHO', 'RIA', 'RIB', 'RID', 'RIF', 'RIG', 'RIM', 'RIN', 'RIP', 'ROB', 'ROC', 'ROD', 'ROE', 'ROM', 'ROT', 'ROW', 'RUB', 'RUE', 'RUG', 'RUM', 'RUN', 'RUT', 'RYA', 'RYE', 'SAB', 'SAC', 'SAD', 'SAE', 'SAG', 'SAL', 'SAP', 'SAT', 'SAU', 'SAW', 'SAX', 'SAY', 'SEA', 'SEC', 'SEE', 'SEG', 'SEI', 'SEL', 'SEN', 'SER', 'SET', 'SEW', 'SEX', 'SHA', 'SHE', 'SHH', 'SHY', 'SIB', 'SIC', 'SIM', 'SIN', 'SIP', 'SIR', 'SIS', 'SIT', 'SIX', 'SKA', 'SKI', 'SKY', 'SLY', 'SOB', 'SOD', 'SOL', 'SOM', 'SON', 'SOP', 'SOS', 'SOT', 'SOU', 'SOW', 'SOX', 'SOY', 'SPA', 'SPY', 'SRI', 'STY', 'SUB', 'SUE', 'SUK', 'SUM', 'SUN', 'SUP', 'SUQ', 'SYN', 'TAB', 'TAD', 'TAE', 'TAG', 'TAJ', 'TAM', 'TAN', 'TAO', 'TAP', 'TAR', 'TAS', 'TAT', 'TAU', 'TAV', 'TAW', 'TAX', 'TEA', 'TEE', 'TEG', 'TEL', 'TEN', 'TET', 'TEW', 'THE', 'THO', 'THY', 'TIC', 'TIE', 'TIL', 'TIN', 'TIP', 'TIS', 'TIT', 'TOD', 'TOE', 'TOG', 'TOM', 'TON', 'TOO', 'TOP', 'TOR', 'TOT', 'TOW', 'TOY', 'TRY', 'TSK', 'TUB', 'TUG', 'TUI', 'TUN', 'TUP', 'TUT', 'TUX', 'TWA', 'TWO', 'TYE', 'UDO', 'UGH', 'UKE', 'ULU', 'UMM', 'UMP', 'UNS', 'UPO', 'UPS', 'URB', 'URD', 'URN', 'URP', 'USE', 'UTA', 'UTE', 'UTS', 'VAC', 'VAN', 'VAR', 'VAS', 'VAT', 'VAU', 'VAV', 'VAW', 'VEE', 'VEG', 'VET', 'VEX', 'VIA', 'VID', 'VIE', 'VIG', 'VIM', 'VIS', 'VOE', 'VOW', 'VOX', 'VUG', 'VUM', 'WAB', 'WAD', 'WAE', 'WAG', 'WAN', 'WAP', 'WAR', 'WAS', 'WAT', 'WAW', 'WAX', 'WAY', 'WEB', 'WED', 'WEE', 'WEN', 'WET', 'WHA', 'WHO', 'WHY', 'WIG', 'WIN', 'WIS', 'WIT', 'WIZ', 'WOE', 'WOG', 'WOK', 'WON', 'WOO', 'WOP', 'WOS', 'WOT', 'WOW', 'WRY', 'WUD', 'WYE', 'WYN', 'XIS', 'YAG', 'YAH', 'YAK', 'YAM', 'YAP', 'YAR', 'YAW', 'YAY', 'YEA', 'YEH', 'YEN', 'YEP', 'YES', 'YET', 'YEW', 'YID', 'YIN', 'YIP', 'YOB', 'YOD', 'YOK', 'YOM', 'YON', 'YOU', 'YOW', 'YUK', 'YUM', 'YUP', 'ZAG', 'ZAP', 'ZAS', 'ZAX', 'ZED', 'ZEE', 'ZEK', 'ZEP', 'ZIG', 'ZIN', 'ZIP', 'ZIT', 'ZOA', 'ZOO', 'ZUZ', 'ZZZ'];


    // Function to create a new draggable letter block
    function createLetterBlock(letter) {
        const block = document.createElement('div');
        block.textContent = letter;
        block.classList.add('letter-block');
        block.draggable = true;
        block.addEventListener('click', () => {
            if (selectedBlock) {
                selectedBlock.classList.remove('selected');
            }
            selectedBlock = block;
            block.classList.add('selected');
        });
        block.addEventListener('dragstart', e => {
            draggedElement = block;
        });
        block.addEventListener('dragend', () => {
            draggedElement = null;
        });
        letterBlocks.appendChild(block);
    }

    // Generate random letters (for simplicity, using a static set)
    const letters = ['G', 'E', 'C', 'N', 'E', 'A', 'T', 'B', 'I'];
    letters.forEach(createLetterBlock);

// Function to handle the beginning of a touch drag
function handleTouchStart(e) {
    // Find the letter block being touched
    const target = e.target.closest('.letter-block');
    if (target) {
        selectedBlock = target;
        // Optionally, you might want to set some state to indicate that dragging has started
        // e.g., add a class to the element, store its initial position, etc.
    }
}

// Function to handle touch movement
function handleTouchMove(e) {
    if (selectedBlock) {
        e.preventDefault(); // Prevent scrolling when dragging
        // Update the position of the selected block based on the touch coordinates
        // You might need to translate the touch position to your grid coordinate system
    }
}

// Function to handle the end of a touch drag
function handleTouchEnd(e) {
    // Find the grid cell where the touch ended
    const targetCell = document.elementFromPoint(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    if (selectedBlock && targetCell && targetCell.classList.contains('grid-cell')) {
        // Perform the drop action here, similar to your existing drop event handler logic
        // Place the letter in the target cell, clear the original cell, etc.
        // Make sure to check if the target cell is part of the grid and not some other element
    }
    // Reset any state indicating that dragging has ended
    selectedBlock = null;
}

// Add touch event listeners to the draggable elements
document.querySelectorAll('.letter-block').forEach(block => {
    block.addEventListener('touchstart', handleTouchStart);
    block.addEventListener('touchmove', handleTouchMove);
    block.addEventListener('touchend', handleTouchEnd);
});
    // Drag and Drop Logic for cells
    cells.forEach(cell => {
        cell.addEventListener('dragover', e => e.preventDefault());
        cell.addEventListener('drop', () => {
            if (draggedElement) {
                if (cell.textContent && draggedElement.classList.contains('grid-cell')) {
                    // Swap contents if both cells are filled and dragging within grid
                    [cell.textContent, draggedElement.textContent] = [draggedElement.textContent, cell.textContent];
                } else {
                    // Move letter to empty cell or from list to grid
                    cell.textContent = draggedElement.textContent;
                    if (draggedElement.classList.contains('grid-cell')) {
                        draggedElement.textContent = ''; // Clear the starting cell
                    } else {
                        draggedElement.remove(); // Remove from list
                    }
                }
            } else if (selectedBlock && !cell.textContent) {
                // Click to place logic
                cell.textContent = selectedBlock.textContent;
                selectedBlock.remove();
                selectedBlock = null;
            }
        });

        // Make grid cells draggable
        cell.draggable = true;
        cell.addEventListener('dragstart', () => {
            draggedElement = cell;
        });

        // Click on cell to return the letter to the list
        cell.addEventListener('click', () => {
            if (selectedBlock && !cell.textContent) {
                cell.textContent = selectedBlock.textContent;
                selectedBlock.remove();
                selectedBlock = null;
            } else if (cell.textContent.trim() !== '') {
                createLetterBlock(cell.textContent);
                cell.textContent = '';
            }
        });
    });

    // Submit Button Logic
    submitButton.addEventListener('click', () => {
        if (isCrosswordValid()) {
            alert('Congratulations! You have made a valid crossword!');
        } else {
            alert('Try again! The crossword is not valid.');
        }
    });

    function isCrosswordValid() {
        // Check each row and column for valid words
        const grid = Array.from(cells).map(cell => cell.textContent || ' ');
        for (let i = 0; i < 3; i++) {
            const rowWord = grid.slice(i * 3, i * 3 + 3).join('');
            const colWord = grid[i] + grid[i + 3] + grid[i + 6];
            if (!validWords.includes(rowWord) || !validWords.includes(colWord)) {
                return false;
            }
        }
        return true;
    }
    // Function to find the cell under the dragged element
function findCellUnderElement(elem) {
    const elemRect = elem.getBoundingClientRect();
    return document.elementFromPoint(
        elemRect.left + elemRect.width / 2,
        elemRect.top + elemRect.height / 2
    );
}

// Update the touch start event handler for the letter blocks
document.querySelectorAll('.letter-block').forEach(block => {
    block.addEventListener('touchstart', e => {
        e.preventDefault();
        selectedBlock = e.target;
        selectedBlock.classList.add('dragging');
    });
});



// ... existing code ...

// A helper function to reset the style of the dragged element
function resetDraggedElementStyle(elem) {
    elem.style.position = '';
    elem.style.left = '';
    elem.style.top = '';
    elem.style.zIndex = '';
}

// Update the touch move event handler on the document
document.addEventListener('touchmove', e => {
    if (selectedBlock) {
        e.preventDefault(); // Prevent scrolling and other default touch behaviors
        const touchLocation = e.targetTouches[0];
        // Apply styles to make the block follow the user's finger
        selectedBlock.style.position = 'fixed';
        selectedBlock.style.left = `${touchLocation.clientX - selectedBlock.offsetWidth / 2}px`;
        selectedBlock.style.top = `${touchLocation.clientY - selectedBlock.offsetHeight / 2}px`;
        selectedBlock.style.zIndex = '1000';
    }
}, { passive: false }); // Set passive to false to allow preventDefault

// Update the touch end event handler on the document
document.addEventListener('touchend', e => {
    if (selectedBlock) {
        const droppedOnCell = findCellUnderElement(selectedBlock);
        if (droppedOnCell && droppedOnCell.classList.contains('grid-cell')) {
            if (droppedOnCell.textContent) {
                // Swap if the cell is already filled
                let temp = droppedOnCell.textContent;
                droppedOnCell.textContent = selectedBlock.textContent;
                selectedBlock.textContent = temp;
            } else {
                // Place the letter in the empty cell
                droppedOnCell.textContent = selectedBlock.textContent;
            }
            // Remove the letter block if it was from the list
            if (!selectedBlock.classList.contains('grid-cell')) {
                selectedBlock.remove();
            }
        } else {
            // If dropped outside the grid, move the block back to the list
            if (!selectedBlock.classList.contains('grid-cell')) {
                selectedBlock.remove();
                createLetterBlock(selectedBlock.textContent);
            }
        }
        // Reset the dragged element style
        resetDraggedElementStyle(selectedBlock);
        selectedBlock.classList.remove('dragging');
        selectedBlock = null;
    }
}, { passive: false });

});