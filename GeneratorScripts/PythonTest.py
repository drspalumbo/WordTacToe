def is_valid_word(word):
    with open("words.txt", "r") as file:
        word_list = [line.strip() for line in file]

    return word.lower() in word_list

if __name__ == "__main__":
    input_word = input("Enter a word: ")
    
    if is_valid_word(input_word):
        print(f"{input_word} is a valid English word.")
    else:
        print(f"{input_word} is not a valid English word.")
    
input("press enter to exit")