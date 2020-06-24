#include "../src/function.h"

int main(int argc, char** argv) {
	for (int i = 0; i < argc; ++i) {
		if (function(i) != 0) {
			return 1;
		}
	}
	return 0;
}