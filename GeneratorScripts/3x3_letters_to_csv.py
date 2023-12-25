from itertools import permutations
import csv

def load_word_list(file_path):
    with open(file_path, 'r') as file:
        return set(word.strip().lower() for word in file.readlines())

def is_valid_solution(grid, word_list):
    for row in grid:
        if ''.join(row).lower() not in word_list:
            return False
    for col in zip(*grid):
        if ''.join(col).lower() not in word_list:
            return False
    return True

def rotate_grid(grid):
    return [list(reversed(col)) for col in zip(*grid)]

def reflect_grid(grid):
    return [list(reversed(row)) for row in grid]

def canonical_form(grid):
    forms = [''.join(''.join(row) for row in grid)]
    for _ in range(3):  # add rotated forms
        grid = rotate_grid(grid)
        forms.append(''.join(''.join(row) for row in grid))
    # Reflect the original grid and add its rotations
    reflected = reflect_grid(grid)
    forms.append(''.join(''.join(row) for row in reflected))
    for _ in range(3):
        reflected = rotate_grid(reflected)
        forms.append(''.join(''.join(row) for row in reflected))
    return min(forms)

def solve_puzzle(letters, word_list):
    solutions = set()
    for perm in permutations(letters, 9):
        grid = [list(perm[0:3]), list(perm[3:6]), list(perm[6:9])]
        if is_valid_solution(grid, word_list):
            solutions.add(canonical_form(grid))
    return len(solutions)

def main(input_file, word_list_file, output_file):
    word_list = load_word_list(word_list_file)
    results = []

    with open(input_file, 'r') as file:
        for line in file:
            letters = line.strip()
            solution_count = solve_puzzle(letters, word_list)
            results.append([letters, solution_count])

    with open(output_file, 'w', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(["Letter Set", "Crossword Count"])  # Header
        writer.writerows(results)

if __name__ == "__main__":
    # Define your file paths here
    input_file = '3x3s_as_string_deduplicated.txt'
    word_list_file = 'three_letter_words_for_solving.txt'
    output_file = '3x3_letters_and_solution_count.csv'
    main(input_file, word_list_file, output_file)