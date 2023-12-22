import sys
sys.setrecursionlimit(500000000) 

def read_word_list(file_path):
    with open(file_path, 'r') as file:
        return set(file.read().splitlines())

def valid_word_in_list(prefix, word_list):
    return [word for word in word_list if word.startswith(prefix)]

def generate_crosswords(input_word, word_list):
    valid_crosswords = []
    crossword = [' '] * 16
    crossword[:4] = list(input_word)
    #print(f"Starting with input word: {input_word}",flush=True)

    for first_vertical_word in valid_word_in_list(crossword[0], word_list):
        # Fill in first vertical word
        crossword[4], crossword[8], crossword[12] = first_vertical_word[1:]

        for second_horizontal_word in valid_word_in_list(crossword[4], word_list):
            # Fill in second horizontal word
            crossword[5:8] = second_horizontal_word[1:]

            # Now, look for valid words that can continue the crossword
            # Calculate the prefixes needed for the third and fourth vertical words
            one_five_prefix = crossword[1] + crossword[5]
            two_six_prefix = crossword[2] + crossword[6]
            three_seven_prefix = crossword[3] + crossword[7]

            column_two_candidates = valid_word_in_list(one_five_prefix, word_list)
            next_vertical_candidates = valid_word_in_list(two_six_prefix, word_list)
            last_vertical_candidates = valid_word_in_list(three_seven_prefix, word_list)

            # Check if valid candidates are found for both vertical words
            if not column_two_candidates or not next_vertical_candidates or not last_vertical_candidates:
                continue

            for column_two_candidate in column_two_candidates:
                # Fill in third vertical word
                crossword[9] = column_two_candidate[2]
                crossword[13] = column_two_candidate[3]

                #0 1 2 3
                #4 5 6 7
                #8 9
                #1213

                eight_nine_prefix = crossword[8] + crossword[9]
                twelve_thirteen_prefix = crossword[12] + crossword[13]

                row_three_candidates = valid_word_in_list(eight_nine_prefix, word_list)
                next_horizontal_candidates = valid_word_in_list(twelve_thirteen_prefix, word_list)

                if not row_three_candidates or not next_horizontal_candidates:
                    continue


                for row_three_candidate in row_three_candidates:
                    # Fill in fourth vertical word
                    crossword[10] = row_three_candidate[2]
                    crossword[11] = row_three_candidate[3]
                    #0 1 2 3
                    #4 5 6 7
                    #8 9 1011
                    #1213

                    # Check if the constructed words are valid for the fifth and sixth vertical slots
                    column_three_prefix = crossword[2] + crossword[6] + crossword[10]
                    prefix_for_sixth_vertical = crossword[3] + crossword[7] + crossword[11]

                    column_three_candidates = valid_word_in_list(column_three_prefix, word_list)
                    column_four_candidates = valid_word_in_list(prefix_for_sixth_vertical, word_list)

                    if not column_three_candidates or not column_four_candidates:
                        continue

                    # print_crossword_so_far(crossword)
                    for column_three_candidate in column_three_candidates:
                        crossword[14] = column_three_candidate[3]  # Fill in the last letter for the fifth vertical word
                        #0 1 2 3
                        #4 5 6 7
                        #8 9 1011
                        #121314
                        
                        row_four_prefix = crossword[12] + crossword[13] + crossword[14]
                        row_four_candidates = valid_word_in_list(row_four_prefix, word_list)

                        if not row_four_candidates:
                            continue


                        #print_crossword_so_far(crossword)
                        for row_four_candidate in row_four_candidates:
                            crossword[15] = row_four_candidate[3]  # Fill in the last letter for the sixth vertical word
                            #0 1 2 3
                            #4 5 6 7
                            #8 9 1011
                            #12131415
                            column_four_word_candidate = crossword[3] + crossword[7] + crossword[11] + crossword[15]

                            # Now check if the last horizontal word is valid
                            if column_four_word_candidate in word_list:
                                #print(f"Found valid crossword: {''.join(crossword)}", flush=True)
                                #print_crossword_so_far(crossword)

                                valid_crosswords.append(''.join(crossword))
                            #else:
                                #print(f"Found failed crossword: {''.join(crossword)}", flush=True)
                               #print_crossword_so_far(crossword)
    return valid_crosswords
def print_crossword_so_far(xword):
    print(f"{xword[0]}{xword[1]}{xword[2]}{xword[3]}\n{xword[4]}{xword[5]}{xword[6]}{xword[7]}\n{xword[8]}{xword[9]}{xword[10]}{xword[11]}\n{xword[12]}{xword[13]}{xword[14]}{xword[15]}\n----", flush=True)
# Main execution
if __name__ == "__main__":
    word_list = read_word_list('4letterDictionary.txt')
    counter = 0
    total_items = len(word_list)

    # Open the file once to clear existing contents or create it if it doesn't exist
    with open('valid_crosswords.txt', 'w') as file:
        pass  # This will clear the file contents

    for inputword in word_list:
        counter += 1
        percentage = (counter / total_items) * 100
        print(f"Word #{counter}/{total_items}, {percentage:.2f}% complete", flush=True)

        valid_crosswords = generate_crosswords(inputword, word_list)

        # Append the valid crosswords to a file after processing each word
        with open('valid_crosswords.txt', 'a') as file:  # 'a' opens the file in append mode
            for crossword in valid_crosswords:
                file.write(f"{crossword}\n")  # Optionally prefix with input word for reference