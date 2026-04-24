import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { RegisterIndividualDto } from './dto/register-individual.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register/individual')
  @ApiOperation({ summary: 'Register a new individual user' })
  @ApiResponse({ status: 201, description: 'User successfully registered.' })
  @ApiResponse({ status: 409, description: 'Email already exists.' })
  async registerIndividual(@Body() dto: RegisterIndividualDto) {
    return this.usersService.registerIndividual(dto);
  }

  @Post('register/designer')
  @ApiOperation({ summary: 'Register a new interior designer' })
  @ApiResponse({ status: 201, description: 'Designer successfully registered.' })
  async registerDesigner(@Body() dto: any) {
    return this.usersService.registerDesigner(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all registered users' })
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Get('designers/list')
  @ApiOperation({ summary: 'Get all interior designers' })
  async getDesigners() {
    return this.usersService.getDesigners();
  }

  @Get('designers/:id')
  @ApiOperation({ summary: 'Get designer by ID' })
  async getDesignerById(@Param('id') id: string) {
    return this.usersService.getDesignerById(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  async getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  async updateUser(@Param('id') id: string, @Body() dto: any) {
    return this.usersService.updateUser(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }

  @Get('designers/pending')
  @ApiOperation({ summary: 'Get all pending interior designers' })
  async getPendingDesigners() {
    return this.usersService.getPendingDesigners();
  }

  @Patch('designers/:id/approve')
  @ApiOperation({ summary: 'Approve or reject a designer' })
  async approveDesigner(
    @Param('id') id: string,
    @Body('isApproved') isApproved: boolean
  ) {
    return this.usersService.approveDesigner(id, isApproved);
  }

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  async login(@Body() dto: any) {
    return this.usersService.login(dto);
  }
}


