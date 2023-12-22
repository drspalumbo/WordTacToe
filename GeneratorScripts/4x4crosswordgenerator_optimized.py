import csv
import itertools

def read_words(file_path):
    """Reads words from the given file."""
    with open(file_path, 'r') as file:
        return [line.strip() for line in file]

def get_valid_prefixes(words, length):
    """Generates a set of valid prefixes of the given length from the word list."""
    return set(word[:length] for word in words if len(word) >= length)

def is_valid_crossword(words, word_set, all_prefixes):
    """Checks if the given words form a valid 4x4 crossword."""
    words = list(words)  # Convert the tuple of words to a list for concatenation
    """Checks if the given words form a valid 4x4 crossword."""
    for i in range(4):
        # Check vertical prefixes are valid for all prefix lengths
        vertical_word = ''.join(word[i] for word in words)
        for length in range(2, len(words[0]) + 1):  # Assuming all words are the same length
            if vertical_word[:length] not in all_prefixes[length]:
                return False
    
    # Check full words (both vertical and horizontal)
    for word in words + [''.join(word[i] for word in words) for i in range(4)]:
        if word not in word_set:
            return False

    return True

def generate_and_save_crosswords(words, all_prefixes, output_csv_path):
    word_set = set(words)
    processed_signatures = set()  # To track unique sets of 16 letters
    total_combinations = len(words) ** 4  # Total number of combinations if using 4-letter words
    combinations_processed = 0  # Keep track of how many combinations we've processed
    
    with open(output_csv_path, 'w', newline='') as csvfile:
        crossword_writer = csv.writer(csvfile)
        crossword_writer.writerow(["Word 1", "Word 2", "Word 3", "Word 4"])
        
        for combination in itertools.product(words, repeat=4):
            combinations_processed += 1
            if combinations_processed % 1000000 == 0:  # Update progress every 10000 combinations
                percent = combinations_processed/total_combinations;
                print(f"Processed {combinations_processed} of {total_combinations} combinations. || {percent}%", flush=True)
            
            signature = ''.join(sorted(''.join(combination)))
            if signature in processed_signatures:
                continue  # Skip if we've already processed this set of letters
            
            if is_valid_crossword(combination, word_set, all_prefixes):
                crossword_writer.writerow(combination)
                csvfile.flush()
                processed_signatures.add(signature)

# Main execution
if __name__ == "__main__":
    words = read_words('4LetterDictionary.txt')  # Path to your 4-letter word dictionary file
    prefix_lengths = range(2, 5)  # For 4-letter words, you need 2-letter, 3-letter and 4-letter prefixes
    all_prefixes = {length: get_valid_prefixes(words, length) for length in prefix_lengths}
    output_csv_path = 'crosswords_4x4_continuous.csv'  # Path for the output CSV file
    generate_and_save_crosswords(words, all_prefixes, output_csv_path)
    print(f"Continuous 4x4 Crosswords saved to: {output_csv_path}")
