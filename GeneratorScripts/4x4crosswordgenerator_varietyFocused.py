import random
import itertools
import csv
import sys
sys.setrecursionlimit(5000) 

def read_words(file_path):
    """Reads words from the given file."""
    with open(file_path, 'r') as file:
        return [line.strip() for line in file]

def get_valid_prefixes(words, max_prefix_length):
    """Generates sets of valid prefixes of lengths up to max_prefix_length from the word list."""
    prefixes = {length: set() for length in range(1, max_prefix_length + 1)}
    for word in words:
        for length in range(1, max_prefix_length + 1):
            prefixes[length].add(word[:length])
    return prefixes


def is_partial_word_valid(partial_word, prefixes):
    """Checks if the given partial word can lead to a valid word according to the known prefixes."""
    return partial_word in prefixes[len(partial_word)]

def is_valid_crossword(words, word_set, all_prefixes):
    """Checks if the given words form a valid 4x4 crossword."""
    for i in range(4):  # Assuming 4x4 crossword
        # Constructing vertical words
        try:
            vertical_word = ''.join(words[j][i] for j in range(4))  # j is row index, i is column index
            if vertical_word not in word_set:
                return False
        except IndexError:
            print(f"Error constructing vertical word at index {i}: {words}")
            return False

    # Check horizontal words (already in 'words' tuple)
    for word in words:
        if word not in word_set:
            return False

    return True

def solve_crossword(current_crossword, word_set, prefixes, all_words, position=0):
    # Debugging output: Print the current crossword state
    print("Current crossword state:", current_crossword)
    
    if position == 16:
        return [current_crossword]


    solutions = []  # To collect solutions
    row, col = divmod(position, 4)  # Determine row and column to fill next
    words_to_try = random.sample(all_words, len(all_words))  # Shuffle words to try
    
    for word in words_to_try:
        # Create a new crossword with the word placed at the current position
        new_crossword = current_crossword[:row * 4] + tuple(word) + current_crossword[(row + 1) * 4:]
        
        # Check if the new crossword is valid so far
        if is_crossword_valid_so_far(new_crossword, position + 4, word_set, prefixes):
            # Recurse with the new crossword, move to the next position
            sub_solutions = solve_crossword(new_crossword, word_set, prefixes, all_words, position + 4)
            solutions.extend(sub_solutions)  # Add any found solutions to our list

    return solutions  # Return the list of solutions found from this position

def is_crossword_valid_so_far(crossword, up_to_position, word_set, prefixes):
    # Check horizontal validity for completed rows
    for r in range(4):
        row_word = ''.join(crossword[r*4:(r+1)*4]).strip()
        if row_word and (row_word not in word_set and row_word not in prefixes[len(row_word)]):
            return False
    
    # Check vertical validity for completed columns
    for c in range(4):
        col_word = ''.join(crossword[c + r*4] for r in range(4)).strip()
        if col_word and (col_word not in word_set and col_word not in prefixes[len(col_word)]):
            return False

    return True

# Main execution
if __name__ == "__main__":
    words = read_words('4LetterDictionary.txt')  # Adjust the file path to your dictionary file
    prefix_lengths = range(2, 5)  # For 4-letter words, you need 2-letter, 3-letter and 4-letter prefixes
    all_prefixes = {length: get_valid_prefixes(words, length) for length in prefix_lengths}
    word_set = set(words)
    crossword_template = tuple([''] * 16)  # Start with an empty crossword
    used_words = set()  # Track words used across all crosswords
    solutions = []  # List to hold the solutions found
    prefixes = get_valid_prefixes(words, 3)
    
    crossword_template = tuple([' ']*16)  # Initialize empty crossword
    solutions = solve_crossword(crossword_template, word_set, prefixes, words)
    print(f"Found {len(solutions)} unique crosswords.")

