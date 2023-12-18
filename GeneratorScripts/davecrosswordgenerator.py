def read_word_list_from_file(file_name):
    with open(file_name, "r") as file:
        word_list = [line.strip() for line in file]
    return word_list

def generate_crossword_blocks(words):
    def is_valid_block(block):
        for row in block:
            if row not in words:
                return False
        for col in zip(*block):
            if "".join(col) not in words:
                return False
        return True

    def generate_block_recursive(block, row):
        if row == 3:
            if is_valid_block(block):
                blocks.append(list(block))
                print("Valid Crossword Block:")
                for r in block:
                    print("".join(r))
                print()
            return

        for word in words:
            block[row] = list(word)
            generate_block_recursive(block, row + 1)

    blocks = []
    line_count = 0  # Initialize a line count variable
    with open('dictionary.txt', 'r') as file:
        for line in file:
            line_count += 1  # Increment the line count for each line
            print(f"Processing line {line_count}...")
            word = line.strip()
            print(word)
            words.append(word)
            print(words)
            if line_count % 100 == 0:  # Print progress every 100 lines
                print(f"Processed {line_count} lines...")
                for i in range(3):
                    generate_block_recursive([[""] * 3 for _ in range(3)], i)

    return blocks

crossword_blocks = generate_crossword_blocks([])
