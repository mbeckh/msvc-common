#include "../src/function.h"

#include <iostream>

int main(int argc, char** argv) {
	for (int i = 0; i < argc; ++i) {
		if (function(i) != 0) {
			std::cout << "[ERROR] arg " << i;
			return 1;
		}
		std::cout << "[OK] arg " << i;
	}
	return 0;
}
