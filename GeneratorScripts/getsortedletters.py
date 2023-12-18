import csv

def read_crosswords(file_path):
    """Reads the crossword combinations from a CSV file."""
    with open(file_path, 'r') as csvfile:
        csv_reader = csv.reader(csvfile)
        next(csv_reader)  # Skip the header
        return [row for row in csv_reader]

def sort_letters_and_save(crosswords, output_file_path):
    """Sorts the letters in each crossword and saves the updated data to a CSV file."""
    with open(output_file_path, 'w', newline='') as csvfile:
        crossword_writer = csv.writer(csvfile)
        crossword_writer.writerow(["Word 1", "Word 2", "Word 3", "Sorted Letters"])
        for row in crosswords:
            sorted_letters = ''.join(sorted(''.join(row)))
            crossword_writer.writerow(row + [sorted_letters])

# Main execution
if __name__ == "__main__":
    input_csv_path = 'crosswords.csv'  # Path to your input CSV file containing the crosswords
    output_csv_path = 'crosswords_sorted_letters.csv'  # Path for the output CSV file
    crosswords = read_crosswords(input_csv_path)
    sort_letters_and_save(crosswords, output_csv_path)
    print(f"Updated crosswords saved to: {output_csv_path}")
