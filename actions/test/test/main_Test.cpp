#include "../src/function.h"

#include <iostream>

int main(int argc, char** argv) {
	for (int i = 0; i < argc; ++i) {
		if (function(i) != 0) {
			std::cout << "[ERROR] arg " << i << std::endl;
			return 1;
		}
		std::cout << "[OK] arg " << i << std::endl;
	}
	std::cout << "[DONE] Tests completed" << std::endl;
	return 0;
}
