#include "function.h"

// function should appear as error in clang-tidy because of invalid case style
int function(int arg) {
	if (arg <= 1) {
		return 0;
	}
	return 1;
}
